#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import json
import pickle
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer, CrossEncoder

# ----------------------------------------------------------------------
# Arabic query normalisation (Egyptian dialect, typos, punctuation)
# ----------------------------------------------------------------------
from arabic_query import bm25_tokenize, normalize_arabic, prepare_search_queries, prepare_user_question

def _normalize_arabic(text: str) -> str:
    return normalize_arabic(text)

def _bm25_tokenize(text: str):
    return bm25_tokenize(text)

# ----------------------------------------------------------------------
# RRF (Reciprocal Rank Fusion) helper
# ----------------------------------------------------------------------
def rrf_score(rank: int, k: int = 60) -> float:
    """RRF score = 1 / (k + rank). Rank starts at 1."""
    return 1.0 / (k + rank)

def hybrid_retrieve_rrf(
    query: str,
    faiss_index,
    embed_model: SentenceTransformer,
    docs: List[Dict],
    bm25: BM25Okapi,
    semantic_k: int = 30,
    bm25_k: int = 30,
    rrf_k: int = 60,
    top_k: int = 15
) -> List[Tuple[int, float]]:
    """
    Hybrid retrieval using Reciprocal Rank Fusion.
    Returns list of (doc_index, fused_score) sorted descending.
    """
    # 1. Semantic (FAISS) search
    q_emb = embed_model.encode([query], normalize_embeddings=True).astype(np.float32)
    sem_scores, sem_idxs = faiss_index.search(q_emb, semantic_k)
    sem_idxs = sem_idxs[0]
    # Build RRF scores from semantic results
    candidates = {}
    for rank, idx in enumerate(sem_idxs, start=1):
        if idx >= 0:
            candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)

    # 2. BM25 search
    tokens = _bm25_tokenize(query)
    if tokens:
        bm25_scores_full = np.asarray(bm25.get_scores(tokens), dtype=np.float32)
        bm25_top = np.argsort(-bm25_scores_full)[:bm25_k]
        for rank, idx in enumerate(bm25_top, start=1):
            if idx >= 0:
                candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)

    # 3. Return top_k sorted by fused score
    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    return sorted_candidates[:top_k]


def hybrid_retrieve_rrf_multi(
    queries: List[str],
    faiss_index,
    embed_model: SentenceTransformer,
    docs: List[Dict],
    bm25: BM25Okapi,
    semantic_k: int = 30,
    bm25_k: int = 30,
    rrf_k: int = 60,
    top_k: int = 15,
) -> List[Tuple[int, float]]:
    """Run hybrid retrieval for several query variants and fuse with RRF."""
    if not queries:
        return []
    merged: Dict[int, float] = {}
    per_query_k = max(top_k, semantic_k // max(len(queries), 1))

    for q in queries:
        if not (q or "").strip():
            continue
        partial = hybrid_retrieve_rrf(
            query=q.strip(),
            faiss_index=faiss_index,
            embed_model=embed_model,
            docs=docs,
            bm25=bm25,
            semantic_k=semantic_k,
            bm25_k=bm25_k,
            rrf_k=rrf_k,
            top_k=per_query_k,
        )
        for rank, (idx, _score) in enumerate(partial, start=1):
            if idx >= 0:
                merged[idx] = merged.get(idx, 0.0) + rrf_score(rank, rrf_k)

    return sorted(merged.items(), key=lambda x: x[1], reverse=True)[:top_k]

# ----------------------------------------------------------------------
# Reranker using CrossEncoder (can be disabled)
# ----------------------------------------------------------------------
class Reranker:
    def __init__(self, model_name: str = "Omartificial-Intelligence-Space/ARA-Reranker-V1"):
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, docs: List[Dict]) -> List[Dict]:
        """Return docs sorted by cross-encoder relevance score."""
        if not docs:
            return docs
        pairs = [[query, d["content"]] for d in docs]
        scores = self.model.predict(pairs)
        for d, s in zip(docs, scores):
            d["rerank_score"] = float(s)
        docs.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return docs

from legal_prompts import SYSTEM_PROMPT, build_rag_user_prompt


def build_prompt(question: str, contexts: List[Dict], chat_history: Optional[List[Dict]] = None) -> str:
    return build_rag_user_prompt(question, contexts, chat_history)

# ----------------------------------------------------------------------
# Main: load store, retrieve (RRF + optional rerank), generate
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Hybrid RAG answer generation with RRF fusion + optional reranking")
    ap.add_argument("--store", type=str, default="rag_store", help="Directory with index.faiss + docstore.json + bm25.pkl")
    ap.add_argument("--query", type=str, required=True, help="User question in Arabic")
    ap.add_argument("--k", type=int, default=5, help="Top-k contexts after reranking")
    ap.add_argument("--semantic_k", type=int, default=30, help="Number of candidates from FAISS (before RRF)")
    ap.add_argument("--bm25_k", type=int, default=30, help="Number of candidates from BM25 (before RRF)")
    ap.add_argument("--faiss_candidates", type=int, default=80, help="(Deprecated) kept for compatibility, use --semantic_k")
    ap.add_argument("--bm25_candidates", type=int, default=80, help="(Deprecated) kept for compatibility, use --bm25_k")
    ap.add_argument(
        "--embed_model",
        type=str,
        default="Omartificial-Intelligence-Space/mmbert-base-arabic-nli",
        help="SentenceTransformer embedding model",
    )
    ap.add_argument(
        "--llm",
        type=str,
        default="Qwen/Qwen2.5-3B-Instruct",
        help="HF model id for generation",
    )
    ap.add_argument("--max_new_tokens", type=int, default=320)
    ap.add_argument("--temperature", type=float, default=0.2)
    ap.add_argument("--no_rerank", action="store_true", help="Disable cross-encoder reranking (faster but less precise)")
    ap.add_argument("--reranker_model", type=str, default="Omartificial-Intelligence-Space/ARA-Reranker-V1",
                    help="CrossEncoder model for reranking")
    args = ap.parse_args()

    # 1. Load persisted indices and docs
    store = Path(args.store)
    faiss_index = faiss.read_index(str(store / "index.faiss"))
    with (store / "docstore.json").open("r", encoding="utf-8") as f:
        docs = json.load(f)

    bm25_path = store / "bm25.pkl"
    if not bm25_path.exists():
        raise SystemExit(f"BM25 not found. Rebuild with: python rag_build_index.py --build_bm25 ... (missing {bm25_path})")
    with bm25_path.open("rb") as f:
        payload = pickle.load(f)
    bm25 = payload.get("bm25")
    if bm25 is None or not isinstance(bm25, BM25Okapi):
        raise SystemExit("Invalid bm25.pkl payload.")

    # 2. Embedder (for query encoding)
    embed_model = SentenceTransformer(args.embed_model)

    # 3. Retrieve using RRF fusion
    semantic_k = args.semantic_k if args.semantic_k else args.faiss_candidates
    bm25_k = args.bm25_k if args.bm25_k else args.bm25_candidates
    candidates = hybrid_retrieve_rrf(
        query=args.query,
        faiss_index=faiss_index,
        embed_model=embed_model,
        docs=docs,
        bm25=bm25,
        semantic_k=semantic_k,
        bm25_k=bm25_k,
        rrf_k=60,
        top_k=args.k * 3   # retrieve more before reranking
    )
    # Convert to list of doc dicts
    retrieved_docs = [docs[idx] for idx, _ in candidates]

    # 4. Rerank (if enabled)
    if not args.no_rerank:
        reranker = CrossEncoder(args.reranker_model)
        pairs = [[args.query, d["content"]] for d in retrieved_docs]
        scores = reranker.predict(pairs)
        for d, s in zip(retrieved_docs, scores):
            d["rerank_score"] = float(s)
        retrieved_docs.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        # Keep only top_k after reranking
        retrieved_docs = retrieved_docs[:args.k]
    else:
        retrieved_docs = retrieved_docs[:args.k]

    # 5. Build prompt (without chat history in CLI mode – can be extended later)
    user_prompt = build_prompt(args.query, retrieved_docs, chat_history=None)

    # 6. Load LLM in 4‑bit (heavy deps only needed for CLI generation)
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    tokenizer = AutoTokenizer.from_pretrained(args.llm, use_fast=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.llm,
        quantization_config=quant_config,
        device_map="auto",
        torch_dtype=torch.float16,
    )
    model.eval()

    # 7. Chat template with system + user
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    inputs = tokenizer(prompt_text, return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            do_sample=args.temperature > 0,
            temperature=args.temperature,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

    # 8. Output
    print("\n=== Question ===")
    print(args.query)
    print("\n=== Retrieved contexts ===")
    for rank, d in enumerate(retrieved_docs, start=1):
        preview = d["content"][:260].replace("\n", " ")
        score_str = f" rerank_score={d.get('rerank_score', 0):.4f}" if not args.no_rerank else ""
        print(f"[{rank}] id={d.get('id')}{score_str} :: {preview}")
    print("\n=== Answer ===")
    print(generated)

if __name__ == "__main__":
    main()