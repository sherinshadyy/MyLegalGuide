#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""HTTP API for the Egyptian legal RAG pipeline (used by the LegalGuide frontend)."""

import base64
import json
import os
import pickle
import re
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

import faiss
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder, SentenceTransformer

import db
from rag_answer import SYSTEM_PROMPT, build_prompt, hybrid_retrieve_rrf_multi
from arabic_query import prepare_user_question
from legal_prompts import (
    DOCUMENT_GENERATION_SYSTEM_PROMPT,
    DOCUMENT_SYSTEM_PROMPT,
    build_document_generation_prompt,
    build_document_user_prompt,
    is_document_generation_request,
)

STORE_DIR = Path(os.getenv("RAG_STORE", "rag_store"))
EMBED_MODEL = os.getenv(
    "RAG_EMBED_MODEL",
    "Omartificial-Intelligence-Space/mmbert-base-arabic-nli",
)
RERANKER_MODEL = os.getenv(
    "RAG_RERANKER_MODEL",
    "Omartificial-Intelligence-Space/ARA-Reranker-V1",
)
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")
PDF_OCR_MAX_PAGES = int(os.getenv("RAG_OCR_MAX_PAGES", "15"))
MIN_DOC_CHARS = 20
TOP_K = int(os.getenv("RAG_TOP_K", "5"))
SEMANTIC_K = int(os.getenv("RAG_SEMANTIC_K", "30"))
BM25_K = int(os.getenv("RAG_BM25_K", "30"))
# Off by default so the API accepts HTTP requests quickly on first run.
USE_RERANK = os.getenv("RAG_USE_RERANK", "0").lower() not in ("0", "false", "no")
MAX_TOKENS = int(os.getenv("RAG_MAX_TOKENS", "768"))
DOC_MAX_TOKENS = int(os.getenv("RAG_DOC_MAX_TOKENS", "1400"))
DOC_GEN_MAX_TOKENS = int(os.getenv("RAG_DOC_GEN_MAX_TOKENS", "3000"))
TEMPERATURE = float(os.getenv("RAG_TEMPERATURE", "0.2"))
QUERY_REWRITE = os.getenv("RAG_QUERY_REWRITE", "1").lower() not in ("0", "false", "no")

_REWRITE_SYSTEM = (
    "حوّل سؤال المستخدم إلى سؤال قانوني مصري واحد واضح بالعربية الفصحى للبحث في نصوص قانونية. "
    "قد يكتب بالعامية المصرية أو بأخطاء إملائية بسيطة أو بدون علامة استفهام. "
    "لا تُجب على السؤال. أخرج السؤال المعاد صياغته فقط في سطر واحد دون شرح."
)

_faiss_index = None
_docs: List[Dict[str, Any]] = []
_bm25 = None
_embed_model: Optional[SentenceTransformer] = None
_reranker: Optional[CrossEncoder] = None
_groq_client = None
_model_lock = threading.Lock()
_models_ready = False
_models_error: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = Field(default_factory=list)
    document_title: Optional[str] = None
    document_text: Optional[str] = None
    generated_document: bool = False


class DocumentRequest(BaseModel):
    text: str = ""
    pdf_base64: str = ""
    filename: str = ""
    user_note: str = ""
    jurisdiction: str = "مصر"
    history: List[ChatMessage] = Field(default_factory=list)


class VoiceTranscribeRequest(BaseModel):
    audio_base64: str = Field(..., min_length=16)
    mime_type: str = "audio/webm"
    lang: str = "ar-EG"


class VoiceTranscribeResponse(BaseModel):
    ok: bool = True
    text: str
    normalized: str = ""
    search_hint: str = ""


_OCR_PAGE_PROMPT = (
    "اقرأ كل النص الظاهر في صورة هذه الصفحة من وثيقة قانونية (عربي أو إنجليزي). "
    "أخرج النص فقط كما هو مكتوب، بدون شرح أو تعليق أو ترجمة."
)


def _decode_pdf_base64(pdf_base64: str) -> bytes:
    import base64

    raw = pdf_base64.strip()
    if "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        return base64.b64decode(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid PDF data: {exc}") from exc


def _pdf_meta(data: bytes) -> Dict[str, Any]:
    """Basic PDF info for user-facing error hints."""
    try:
        import fitz

        doc = fitz.open(stream=data, filetype="pdf")
        meta = {
            "pages": len(doc),
            "encrypted": bool(doc.is_encrypted),
            "needs_pass": bool(doc.needs_pass),
        }
        doc.close()
        return meta
    except Exception:
        return {"pages": 0, "encrypted": False, "needs_pass": False}


def _page_png_base64(page: Any, zoom: float = 2.0, max_side: int = 1600) -> str:
    import base64

    import fitz

    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    if max(pix.width, pix.height) > max_side:
        scale = max_side / float(max(pix.width, pix.height))
        mat = fitz.Matrix(zoom * scale, zoom * scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
    return base64.standard_b64encode(pix.tobytes("png")).decode("ascii")


def _ocr_pdf_with_vision(data: bytes) -> str:
    """Read scanned PDF pages via Groq vision when normal text extraction fails."""
    if not _groq_client:
        return ""

    import fitz

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        print(f"[rag] OCR open PDF: {exc}")
        return ""

    if doc.is_encrypted or doc.needs_pass:
        doc.close()
        raise HTTPException(
            status_code=400,
            detail=(
                "الملف محمي بكلمة سر.\n"
                "• افتح الـPDF على جهازك وأدخل كلمة السر\n"
                "• احفظ نسخة جديدة بدون حماية (Print to PDF أو Save As)\n"
                "• ثم ارفع النسخة الجديدة"
            ),
        )

    n_pages = len(doc)
    limit = min(n_pages, PDF_OCR_MAX_PAGES)
    parts: List[str] = []

    for i in range(limit):
        try:
            b64 = _page_png_base64(doc[i])
            response = _groq_client.chat.completions.create(
                model=GROQ_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _OCR_PAGE_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{b64}"},
                            },
                        ],
                    }
                ],
                max_tokens=2500,
                temperature=0.0,
            )
            page_text = (response.choices[0].message.content or "").strip()
            if page_text and page_text.lower() not in ("no text", "لا يوجد نص"):
                parts.append(page_text)
        except Exception as exc:
            print(f"[rag] OCR page {i + 1}: {exc}")

    doc.close()
    combined = "\n\n".join(parts).strip()
    if n_pages > limit and combined:
        combined += f"\n\n[ملاحظة: تم قراءة أول {limit} صفحة من {n_pages}.]"
    return combined


def _extract_pdf_text_from_bytes(data: bytes) -> str:
    """Text layer first, then vision OCR for scanned pages."""
    import io

    best = ""

    try:
        import fitz

        doc = fitz.open(stream=data, filetype="pdf")
        if doc.is_encrypted or doc.needs_pass:
            doc.close()
            raise HTTPException(
                status_code=400,
                detail=(
                    "الملف محمي بكلمة سر.\n"
                    "• افتحه وأدخل كلمة السر ثم احفظ نسخة بدون حماية\n"
                    "• أو ارفع ملف TXT بنفس المحتوى"
                ),
            )
        parts: List[str] = []
        for page in doc:
            t = (page.get_text("text") or "").strip()
            if len(t) < 5:
                blocks = page.get_text("blocks") or []
                t = "\n".join(
                    str(b[4]).strip() for b in blocks if len(b) > 4 and str(b[4]).strip()
                )
            parts.append(t)
        doc.close()
        best = "\n\n".join(parts).strip()
        if len(best) >= MIN_DOC_CHARS:
            return best
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[rag] PyMuPDF extract: {exc}")

    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        parts = [(p.extract_text() or "").strip() for p in reader.pages]
        alt = "\n\n".join(parts).strip()
        if len(alt) > len(best):
            best = alt
        if len(best) >= MIN_DOC_CHARS:
            return best
    except Exception as exc:
        print(f"[rag] pypdf extract: {exc}")

    if len(best) < MIN_DOC_CHARS:
        print("[rag] Trying vision OCR for scanned PDF...")
        ocr_text = _ocr_pdf_with_vision(data)
        if len(ocr_text) >= MIN_DOC_CHARS:
            return ocr_text
        if ocr_text and len(ocr_text) > len(best):
            best = ocr_text

    return best


def _pdf_read_failure_detail(data: bytes, extracted_len: int) -> str:
    meta = _pdf_meta(data)
    pages = int(meta.get("pages") or 0)
    lines = [
        "مقدرناش نقرأ نص كفاية من ملف الـPDF. ده ممكن يحصل لو:",
    ]
    if meta.get("encrypted") or meta.get("needs_pass"):
        lines.append("• الملف **محمي بكلمة سر** — افتحه واحفظ نسخة بدون حماية")
    if pages == 0:
        lines.append("• الملف **تالف** أو مش PDF صحيح")
    elif pages > PDF_OCR_MAX_PAGES:
        lines.append(
            f"• الملف فيه **{pages} صفحة** — اتقرأ أول {PDF_OCR_MAX_PAGES} بس؛ جرّب ملف أقصر أو TXT"
        )
    if extracted_len > 0:
        lines.append(f"• اتقرأ **{extracted_len} حرف بس** — الصور ممكن تكون ضبابية أو مائلة")
    else:
        lines.append("• الصفحات **صور فاضية أو غير واضحة** (مسح ضعيف، ظل، قص جزء من الصفحة)")
    lines.extend(
        [
            "• الملف **Word** اتعمله حفظ غلط — احفظ من Word: PDF أو TXT",
            "",
            "**إيه اللي تعمله:**",
            "1) ارفع **ملف TXT** (انسخ النص من العقد)",
            "2) حسّن المسح: إضاءة كويسة، الصفحة مستقيمة، بدون ظل",
            "3) من Google Drive: ارفع PDF → افتح → انسخ النص → الصقه في الشات",
        ]
    )
    return "\n".join(lines)


def _extract_document_text(req: DocumentRequest) -> str:
    if req.text and len(req.text.strip()) >= MIN_DOC_CHARS:
        return req.text.strip()
    if req.pdf_base64:
        data = _decode_pdf_base64(req.pdf_base64)

        if len(data) < 100:
            raise HTTPException(status_code=400, detail="ملف الـPDF فاضي أو تالف.")

        text = _extract_pdf_text_from_bytes(data)
        if len(text) >= MIN_DOC_CHARS:
            return text

        raise HTTPException(
            status_code=400,
            detail=_pdf_read_failure_detail(data, len(text.strip())),
        )
    raise HTTPException(status_code=400, detail="Provide text or pdf_base64")


def _load_index() -> None:
    global _faiss_index, _docs, _bm25, _groq_client

    if not STORE_DIR.exists():
        raise FileNotFoundError(f"RAG store not found: {STORE_DIR.resolve()}")

    print("[rag] Loading FAISS index and docstore...")
    _faiss_index = faiss.read_index(str(STORE_DIR / "index.faiss"))
    try:
        db.init_db()
        _docs[:] = db.load_docstore_from_db()
        if not _docs:
            raise ValueError("empty mysql docstore")
        print(f"[db] Loaded {_docs.__len__()} docs from MySQL")
    except Exception:
        with (STORE_DIR / "docstore.json").open("r", encoding="utf-8") as f:
            _docs[:] = json.load(f)
        try:
            db.sync_json_docstore_to_db(STORE_DIR / "docstore.json")
            print(f"[db] Synced {_docs.__len__()} docs from JSON to MySQL")
        except Exception as db_err:
            print(f"[db] Could not sync docstore to MySQL: {db_err}")

    bm25_path = STORE_DIR / "bm25.pkl"
    if not bm25_path.exists():
        raise FileNotFoundError(f"Missing BM25 index: {bm25_path}")
    with bm25_path.open("rb") as f:
        payload = pickle.load(f)
    _bm25 = payload.get("bm25")
    if _bm25 is None:
        raise ValueError("Invalid bm25.pkl payload")

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if api_key:
        from groq import Groq

        _groq_client = Groq(api_key=api_key)
        print("[rag] Groq client ready.")
    else:
        print("[rag] WARNING: GROQ_API_KEY not set — chat will fail until you add it to .env")


def _load_ml_models() -> None:
    global _embed_model, _reranker, _models_ready, _models_error

    with _model_lock:
        if _models_ready or _models_error:
            return
        try:
            print(f"[rag] Loading embedding model ({EMBED_MODEL}) — first run may take several minutes...")
            _embed_model = SentenceTransformer(EMBED_MODEL)
            if USE_RERANK:
                print(f"[rag] Loading reranker ({RERANKER_MODEL})...")
                _reranker = CrossEncoder(RERANKER_MODEL)
            _models_ready = True
            print("[rag] ML models ready.")
        except Exception as exc:
            _models_error = str(exc)
            print(f"[rag] FATAL loading models: {exc}")
            raise


def _ensure_models() -> None:
    if _models_error:
        raise HTTPException(status_code=503, detail=f"Model load failed: {_models_error}")
    if not _models_ready:
        _load_ml_models()


def _warm_models_background() -> None:
    def _run():
        try:
            _load_ml_models()
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()


def _warm_voice_background() -> None:
    def _run() -> None:
        try:
            from voice_stt import preload_whisper, voice_stt_config

            if voice_stt_config()["enabled"]:
                preload_whisper()
                print("[rag] voice STT model ready")
        except Exception as exc:
            print(f"[rag] voice STT warm-up skipped: {exc}")

    threading.Thread(target=_run, daemon=True).start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_index()
    _warm_models_background()
    _warm_voice_background()
    print(f"[rag] API listening — docs={len(_docs)}, rerank={USE_RERANK}, groq={_groq_client is not None}")
    yield


app = FastAPI(title="Egyptian Legal RAG API", version="1.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _rewrite_query_for_search(question: str) -> str:
    """Optional Groq pass: formalize dialect / typos before retrieval."""
    if not _groq_client or not QUERY_REWRITE:
        return ""
    try:
        response = _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _REWRITE_SYSTEM},
                {"role": "user", "content": question},
            ],
            max_tokens=120,
            temperature=0.0,
        )
        text = (response.choices[0].message.content or "").strip()
        return text.split("\n")[0].strip()
    except Exception as exc:
        print(f"[rag] query rewrite skipped: {exc}")
        return ""


def _retrieval_question(raw_question: str, history: List[Dict[str, str]]) -> str:
    """Blend follow-up questions with prior user turn for better retrieval."""
    if not history:
        return raw_question
    last_user = ""
    for msg in reversed(history):
        if msg.get("role") == "user" and msg.get("content"):
            last_user = str(msg["content"]).strip()
            break
    if not last_user:
        return raw_question
    q = raw_question.strip()
    short = len(q) < 80 or any(
        w in q for w in ("و", "طيب", "لو", "نفس", "ايضا", "كمان", "برضه", "ده", "دي", "هو", "هي")
    )
    if short:
        return f"{last_user} {q}".strip()
    return q


def _search_queries_for(raw_question: str) -> List[str]:
    prepared = prepare_user_question(raw_question)
    queries: List[str] = list(prepared.get("search_queries") or [])
    cleaned = str(prepared.get("cleaned") or "").strip()

    rewritten = _rewrite_query_for_search(cleaned or raw_question)
    if rewritten:
        queries.insert(0, rewritten)

    seen = set()
    unique: List[str] = []
    for q in queries:
        q = q.strip()
        if q and q not in seen:
            seen.add(q)
            unique.append(q)
    return unique or [raw_question.strip()]


def _retrieve(raw_question: str, rerank_query: str, history: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, Any]]:
    _ensure_models()
    retrieval_q = _retrieval_question(raw_question, history or [])
    search_queries = _search_queries_for(retrieval_q)
    if retrieval_q != raw_question:
        search_queries.insert(0, raw_question.strip())

    candidates = hybrid_retrieve_rrf_multi(
        queries=search_queries,
        faiss_index=_faiss_index,
        embed_model=_embed_model,
        docs=_docs,
        bm25=_bm25,
        semantic_k=SEMANTIC_K,
        bm25_k=BM25_K,
        rrf_k=60,
        top_k=TOP_K * 3,
    )
    retrieved = [_docs[idx] for idx, _ in candidates]

    if USE_RERANK and _reranker and retrieved:
        pairs = [[rerank_query, d["content"]] for d in retrieved]
        scores = _reranker.predict(pairs)
        for d, s in zip(retrieved, scores):
            d["rerank_score"] = float(s)
        retrieved.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)

    return retrieved[:TOP_K]


def _generate(query: str, contexts: List[Dict[str, Any]], history: List[Dict[str, str]]) -> str:
    user_prompt = build_prompt(query, contexts, chat_history=history or None)

    if _groq_client is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not set. Copy .env.example to .env and add your key from https://console.groq.com/",
        )

    response = _groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT.strip()},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
    )
    return (response.choices[0].message.content or "").strip()


def _parse_generated_document(raw: str) -> tuple:
    text = (raw or "").strip()
    m_title = re.search(r"===TITLE===\s*(.+?)\s*===BODY===", text, re.DOTALL | re.IGNORECASE)
    m_body = re.search(r"===BODY===\s*(.+?)\s*===NOTE===", text, re.DOTALL | re.IGNORECASE)
    m_note = re.search(r"===NOTE===\s*(.+)$", text, re.DOTALL | re.IGNORECASE)
    if m_title and m_body and m_note:
        return (
            m_title.group(1).strip(),
            m_body.group(1).strip(),
            m_note.group(1).strip(),
        )
    return (
        "مسودة قانونية",
        text,
        "تم إنشاء المسودة. يُرجى مراجعتها من محامٍ مرخص قبل الاستخدام.",
    )


def _generate_legal_document(
    query: str,
    contexts: List[Dict[str, Any]],
    history: List[Dict[str, str]],
) -> tuple:
    user_prompt = build_document_generation_prompt(query, contexts, chat_history=history or None)

    if _groq_client is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not set. Copy .env.example to .env and add your key from https://console.groq.com/",
        )

    response = _groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": DOCUMENT_GENERATION_SYSTEM_PROMPT.strip()},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=DOC_GEN_MAX_TOKENS,
        temperature=0.35,
    )
    raw = (response.choices[0].message.content or "").strip()
    title, body, note = _parse_generated_document(raw)
    return note, title, body


@app.get("/health")
def health() -> Dict[str, Any]:
    voice_info: Dict[str, Any] = {"enabled": False, "ready": False, "loading": False}
    try:
        from voice_stt import whisper_status

        voice_info = whisper_status()
    except ImportError:
        voice_info["error"] = "requirements-voice.txt not installed"
    except Exception as exc:
        voice_info["error"] = str(exc)
    return {
        "ok": True,
        "store": str(STORE_DIR),
        "docs": len(_docs),
        "groq": _groq_client is not None,
        "rerank": USE_RERANK,
        "models_ready": _models_ready,
        "models_loading": not _models_ready and _models_error is None,
        "models_error": _models_error,
        "voice_stt": voice_info,
    }


@app.post("/voice/transcribe", response_model=VoiceTranscribeResponse)
def voice_transcribe(req: VoiceTranscribeRequest) -> VoiceTranscribeResponse:
    try:
        from voice_stt import transcribe_audio_bytes, voice_stt_config
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Voice STT not installed. Run: pip install -r requirements-voice.txt",
        ) from exc

    if not voice_stt_config()["enabled"]:
        raise HTTPException(status_code=503, detail="Voice STT is disabled (VOICE_STT_ENABLED=0)")

    raw_b64 = req.audio_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        audio_bytes = base64.b64decode(raw_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid audio data: {exc}") from exc

    try:
        result = transcribe_audio_bytes(audio_bytes, mime_type=req.mime_type, lang=req.lang)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return VoiceTranscribeResponse(
        text=result["text"],
        normalized=result.get("normalized") or "",
        search_hint=result.get("search_hint") or "",
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    query = req.message.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Empty message")

    if not _models_ready and not _models_error:
        raise HTTPException(
            status_code=503,
            detail="Models are still loading. Wait 1–3 minutes (first run downloads from Hugging Face) then try again.",
        )

    history = [
        {"role": m.role, "content": m.content}
        for m in req.history
        if m.role in ("user", "assistant") and m.content.strip()
    ]

    prepared = prepare_user_question(query)
    llm_question = str(prepared.get("original") or query).strip()
    hist_dicts = [{"role": m.role, "content": m.content} for m in req.history if m.content.strip()]
    contexts = _retrieve(query, rerank_query=str(prepared.get("cleaned") or query), history=hist_dicts)
    sources = [str(c.get("id", "")) for c in contexts if c.get("id")]

    if is_document_generation_request(query):
        reply, doc_title, doc_text = _generate_legal_document(llm_question, contexts, hist_dicts)
        return ChatResponse(
            reply=reply,
            sources=sources,
            document_title=doc_title,
            document_text=doc_text,
            generated_document=True,
        )

    reply = _generate(llm_question, contexts, hist_dicts)
    return ChatResponse(reply=reply, sources=sources)


def _generate_document_analysis(req: DocumentRequest) -> str:
    if _groq_client is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not set.",
        )
    hist = [{"role": m.role, "content": m.content} for m in req.history if m.content.strip()]
    user_prompt = build_document_user_prompt(
        req.text.strip(),
        user_note=req.user_note,
        jurisdiction=req.jurisdiction or "مصر",
    )
    messages = [{"role": "system", "content": DOCUMENT_SYSTEM_PROMPT.strip()}]
    if hist:
        messages.append({
            "role": "user",
            "content": "سجل سابق للمحادثة (للمرجع فقط):\n"
            + "\n".join(
                f"{'المستخدم' if m['role'] == 'user' else 'المساعد'}: {m['content']}"
                for m in hist[-6:]
            ),
        })
    messages.append({"role": "user", "content": user_prompt})
    response = _groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=DOC_MAX_TOKENS,
        temperature=0.25,
    )
    return (response.choices[0].message.content or "").strip()


@app.post("/analyze-document", response_model=ChatResponse)
def analyze_document(req: DocumentRequest) -> ChatResponse:
    doc_text = _extract_document_text(req)
    if len(doc_text) > 150000:
        raise HTTPException(status_code=400, detail="Document too large (max ~150k chars)")
    req_copy = req.model_copy()
    req_copy.text = doc_text
    reply = _generate_document_analysis(req_copy)
    return ChatResponse(reply=reply, sources=[])


if __name__ == "__main__":
    host = os.getenv("RAG_API_HOST", "127.0.0.1")
    port = int(os.getenv("RAG_API_PORT", "8000"))
    uvicorn.run("rag_api:app", host=host, port=port, reload=False)
