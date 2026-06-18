#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import streamlit as st
import json
import pickle
import re
import time
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from groq import Groq

import db

# ------------------------------------------------------------
# 1. Load persisted RAG store (cached)
# ------------------------------------------------------------
@st.cache_resource
def load_rag_store():
    db.init_db()
    docs = db.load_docstore_from_db()
    if docs:
        print(f"[db] Loaded {len(docs)} docs from MySQL")
    else:
        store = Path(os.getenv("RAG_STORE", "rag_store"))
        docstore_path = store / "docstore.json"
        if not docstore_path.exists():
            raise FileNotFoundError(f"Missing docstore.json in {store}")
        with docstore_path.open("r", encoding="utf-8") as f:
            docs = json.load(f)
        db.sync_json_docstore_to_db(docstore_path)
        print(f"[db] Imported {len(docs)} docs from file into MySQL")

    index = faiss.read_index(str(Path(os.getenv("RAG_STORE", "rag_store")) / "index.faiss"))
    with (Path(os.getenv("RAG_STORE", "rag_store")) / "bm25.pkl").open("rb") as f:
        bm25 = pickle.load(f)["bm25"]
    embed_model = SentenceTransformer("Omartificial-Intelligence-Space/mmbert-base-arabic-nli")
    return index, docs, bm25, embed_model

# ------------------------------------------------------------
# 2. Groq client – use environment variable for production!
# ------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

@st.cache_resource
def get_groq_client():
    if not GROQ_API_KEY:
        raise RuntimeError("Set GROQ_API_KEY in your environment before running the app.")
    return Groq(api_key=GROQ_API_KEY)

# ------------------------------------------------------------
# 3. Arabic text normalisation (shared with indexing)
# ------------------------------------------------------------
_AR_DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]")
_AR_TATWEEL_RE = re.compile(r"\u0640")
_AR_WHITESPACE_RE = re.compile(r"\s+")
_AR_PUNCT_RE = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)

def _normalize_arabic(text: str) -> str:
    text = _AR_TATWEEL_RE.sub("", text)
    text = _AR_DIACRITICS_RE.sub("", text)
    text = _AR_PUNCT_RE.sub(" ", text)
    text = _AR_WHITESPACE_RE.sub(" ", text).strip()
    return text

def _bm25_tokenize(text: str):
    norm = _normalize_arabic(text)
    if not norm:
        return []
    return norm.split(" ")

# ------------------------------------------------------------
# 4. RRF fusion retrieval
# ------------------------------------------------------------
def rrf_score(rank: int, k: int = 60) -> float:
    return 1.0 / (k + rank)

def hybrid_retrieve_rrf(
    query: str,
    faiss_index,
    embed_model,
    docs,
    bm25,
    semantic_k: int = 30,
    bm25_k: int = 30,
    rrf_k: int = 60,
    top_k: int = 5,
):
    q_emb = embed_model.encode([query], normalize_embeddings=True).astype(np.float32)
    sem_scores, sem_idxs = faiss_index.search(q_emb, semantic_k)
    sem_idxs = sem_idxs[0]

    candidates = {}
    for rank, idx in enumerate(sem_idxs, start=1):
        if idx >= 0:
            candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)

    tokens = _bm25_tokenize(query)
    if tokens:
        bm25_scores_full = np.asarray(bm25.get_scores(tokens), dtype=np.float32)
        bm25_top = np.argsort(-bm25_scores_full)[:bm25_k]
        for rank, idx in enumerate(bm25_top, start=1):
            if idx >= 0:
                candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)

    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    return [(idx, score) for idx, score in sorted_candidates[:top_k]]

# ------------------------------------------------------------
# 5. Prompt building (System prompt in Arabic, user prompt in Arabic)
# ------------------------------------------------------------
SYSTEM_PROMPT = """أنت مساعد قانوني مصري خبير. أجب فقط بناءً على المعلومات الواردة في "السياق". قواعد صارمة:

1. لا تستخدم معرفة خارجية. إذا لم تكفِ المعلومات، قل: "السياق المتاح لا يذكر إجابة كافية".
2. استشهد بالمصادر بعد كل جملة (مثال: (المصدر: chunk-0004)).
3. إذا كان السؤال عن "عقوبة"، فلا تذكر إجراءات التنفيذ (مثل استدعاء الشرطة).
4. لا تغير حروف العطف أو النفي.
5. أجب باختصار ووضوح.
"""

def build_prompt(query: str, contexts):
    ctx_blocks = []
    for c in contexts:
        ctx_blocks.append(f"[id={c['id']}]\n{c['content']}")
    joined_ctx = "\n\n".join(ctx_blocks)
    return f"السؤال: {query}\n\nالسياق المتاح:\n{joined_ctx}\n\nالإجابة:"

# ------------------------------------------------------------
# 6. Main Streamlit app (All UI text in English)
# ------------------------------------------------------------
def main():
    st.set_page_config(page_title="Egyptian Legal Assistant - RAG with Groq", layout="wide")
    st.title("⚖️ Egyptian Legal Assistant (RAG + Groq)")

    with st.sidebar:
        st.header("Retrieval Settings")
        k = st.slider("Number of retrieved chunks (k)", 1, 15, 3)
        semantic_k = st.slider("FAISS candidates", 10, 200, 30)
        bm25_k = st.slider("BM25 candidates", 10, 200, 30)

        st.markdown("---")
        st.header("Generation Settings (Groq)")
        use_generation = st.checkbox("Enable Groq generation", value=True)
        if use_generation:
            available_models = [
                "llama-3.3-70b-versatile",
                "llama-4-scout-171b",
                "qwen-2.5-32b",
                "allam-2-7b",
                "mistral-saba-24b"
            ]
            selected_model = st.selectbox("Select Groq model", available_models, index=0)
            temperature = st.slider("Temperature (creativity)", 0.0, 1.0, 0.2, step=0.05)
            max_tokens = st.number_input("Max new tokens", 100, 1024, 512)

    with st.spinner("Loading knowledge base..."):
        idx, docs, bm25, embed_model = load_rag_store()

    if use_generation:
        client = get_groq_client()
        st.session_state["selected_model"] = selected_model
        st.session_state["temperature"] = temperature
        st.session_state["max_new_tokens"] = max_tokens

    query = st.text_area("Ask your legal question (in Arabic):", height=120,
                         placeholder="Example:...اكتب سؤالك هنا")

    col1, col2 = st.columns(2)
    with col1:
        run_retrieval_btn = st.button("🔍 Retrieve only", type="secondary", use_container_width=True)
    with col2:
        run_full_btn = st.button("✨ Retrieve + Generate (Groq)", type="primary", use_container_width=True,
                                 disabled=not use_generation)

    if run_retrieval_btn or run_full_btn:
        if not query.strip():
            st.warning("Please enter a question.")
            return

        # ---------- Retrieval ----------
        with st.spinner("Searching..."):
            start = time.time()
            results = hybrid_retrieve_rrf(
                query, idx, embed_model, docs, bm25,
                semantic_k=semantic_k, bm25_k=bm25_k,
                top_k=k
            )
            retrieval_time = time.time() - start

        retrieved_chunks = [docs[i] for i, _ in results]

        st.subheader(f" Retrieved chunks (k={k})")
        st.caption(f"Retrieval time: {retrieval_time:.2f} seconds")
        for rank, (doc, (_, score)) in enumerate(zip(retrieved_chunks, results), start=1):
            with st.expander(f"Chunk {rank} | id={doc['id']} | score={score:.4f}"):
                st.write(doc['content'])

        # ---------- Generation ----------
        if run_full_btn and use_generation:
            st.subheader(" Generated answer (Groq)")
            with st.spinner("Connecting to Groq API..."):
                final_prompt = build_prompt(query, retrieved_chunks)
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": final_prompt}
                ]

                try:
                    response = client.chat.completions.create(
                        model=st.session_state["selected_model"],
                        messages=messages,
                        max_tokens=st.session_state["max_new_tokens"],
                        temperature=st.session_state["temperature"],
                        stream=True
                    )
                    answer_container = st.empty()
                    full_answer = ""
                    for chunk in response:
                        delta = chunk.choices[0].delta.content or ""
                        full_answer += delta
                        answer_container.markdown(full_answer + "▌")
                    answer_container.markdown(full_answer)

                except Exception as e:
                    st.error(f"Groq API error: {e}")

                if st.button("Save this answer"):
                    record = {
                        "query": query,
                        "answer": full_answer,
                        "chunks_used": [doc["id"] for doc in retrieved_chunks]
                    }
                    if db.save_user_answer(record):
                        st.success("Answer saved to MySQL.")
                    else:
                        st.error("Could not save answer to MySQL.")
    st.markdown("---")
    st.caption("Hybrid retrieval (FAISS + BM25) with RRF fusion. Generation via Groq API.")

if __name__ == "__main__":
    main()