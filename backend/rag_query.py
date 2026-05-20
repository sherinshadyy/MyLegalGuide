#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import json
import pickle
import re
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer


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


def rrf_score(rank: int, k: int = 60) -> float:
    """RRF score = 1 / (k + rank). Rank starts at 1."""
    return 1.0 / (k + rank)


def hybrid_retrieve_rrf(
    query: str,
    faiss_index,
    embed_model: SentenceTransformer,
    docs,
    bm25: BM25Okapi,
    semantic_k: int = 30,
    bm25_k: int = 30,
    top_k: int = 5,
):
    """
    Hybrid retrieval using Reciprocal Rank Fusion.
    Returns list of (doc_index, fused_score) sorted descending.
    """
    q_emb = embed_model.encode([query], normalize_embeddings=True).astype(np.float32)

    candidates = {}

    # 1. FAISS (dense) – use semantic_k candidates
    sem_scores, sem_idxs = faiss_index.search(q_emb, semantic_k)
    sem_idxs = sem_idxs[0]
    for rank, idx in enumerate(sem_idxs, start=1):
        if idx >= 0:
            candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank)

    # 2. BM25 (sparse) – use bm25_k candidates
    tokens = _bm25_tokenize(query)
    if tokens:
        bm25_scores_full = np.asarray(bm25.get_scores(tokens), dtype=np.float32)
        bm25_top = np.argsort(-bm25_scores_full)[:bm25_k]
        for rank, idx in enumerate(bm25_top, start=1):
            if idx >= 0:
                candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank)

    # 3. Sort by fused score
    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    return [(idx, score) for idx, score in sorted_candidates[:top_k]]


def main():
    ap = argparse.ArgumentParser(description="Query a RAG store (FAISS + BM25 + RRF hybrid) built from chunked_data.json")
    ap.add_argument("--store", type=str, default="rag_store", help="Directory with index.faiss + docstore.json + bm25.pkl")
    ap.add_argument(
        "--model",
        type=str,
        default="Omartificial-Intelligence-Space/mmbert-base-arabic-nli",
        help="SentenceTransformer model name (must match build for best results)",
    )
    ap.add_argument("--query", type=str, required=True, help="User question in Arabic")
    ap.add_argument("--k", type=int, default=5, help="Top-k results")
    ap.add_argument(
        "--mode",
        type=str,
        default="hybrid",
        choices=["faiss", "bm25", "hybrid"],
        help="Retrieval mode: faiss (dense), bm25 (sparse), hybrid (RRF fusion)",
    )
    ap.add_argument("--semantic_k", type=int, default=30, help="Number of FAISS candidates for hybrid mode")
    ap.add_argument("--bm25_k", type=int, default=30, help="Number of BM25 candidates for hybrid mode")
    args = ap.parse_args()

    store = Path(args.store)
    index = faiss.read_index(str(store / "index.faiss"))
    with (store / "docstore.json").open("r", encoding="utf-8") as f:
        docs = json.load(f)

    # Load BM25 if needed
    bm25 = None
    bm25_path = store / "bm25.pkl"
    if bm25_path.exists():
        with bm25_path.open("rb") as f:
            payload = pickle.load(f)
        bm25 = payload.get("bm25")
        if bm25 is not None and not isinstance(bm25, BM25Okapi):
            bm25 = None

    # Load embedding model (for FAISS and hybrid)
    if args.mode in ("faiss", "hybrid"):
        embed_model = SentenceTransformer(args.model)
    else:
        embed_model = None

    def run_faiss(topk: int):
        q = embed_model.encode([args.query], normalize_embeddings=True).astype(np.float32)
        return index.search(q, topk)

    if args.mode == "faiss":
        scores, idxs = run_faiss(args.k)
        final = list(zip(idxs[0].tolist(), scores[0].tolist()))

    elif args.mode == "bm25":
        if bm25 is None:
            raise SystemExit(f"BM25 not found. Rebuild with: python rag_build_index.py --build_bm25 ... (missing {bm25_path})")
        qtok = _bm25_tokenize(args.query)
        bm25_scores = np.asarray(bm25.get_scores(qtok), dtype=np.float32)
        top = np.argsort(-bm25_scores)[:args.k]
        final = [(int(i), float(bm25_scores[i])) for i in top]

    else:  # hybrid – RRF fusion
        if bm25 is None:
            raise SystemExit(f"BM25 not found. Rebuild with: python rag_build_index.py --build_bm25 ... (missing {bm25_path})")
        final = hybrid_retrieve_rrf(
            query=args.query,
            faiss_index=index,
            embed_model=embed_model,
            docs=docs,
            bm25=bm25,
            semantic_k=args.semantic_k,
            bm25_k=args.bm25_k,
            top_k=args.k,
        )

    print("\n=== Query ===")
    print(args.query)
    print("\n=== Top matches ===")
    for rank, (i, s) in enumerate(final, start=1):
        if i < 0 or i >= len(docs):
            continue
        d = docs[i]
        preview = d["content"][:700].replace("\n", " ")
        print(f"\n[{rank}] score={float(s):.4f}  id={d.get('id')} ")
        print(preview)


if __name__ == "__main__":
    main()