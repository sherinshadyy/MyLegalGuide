#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Evaluation runner – now uses RRF fusion + optional reranking.

Input JSONL format (one per line):
{
  "query": "...",
  "gold_chunk_ids": ["chunk-0003"],     # optional
  "gold_answer": "..."                  # optional
}
"""

import argparse
import json
import pickle
import re
from pathlib import Path
from typing import List, Tuple

import faiss
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer, CrossEncoder

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

# ----------------------------------------------------------------------
# RRF fusion (same as in rag_answer)
# ----------------------------------------------------------------------
def rrf_score(rank: int, k: int = 60) -> float:
    return 1.0 / (k + rank)

def hybrid_retrieve_rrf(
    query: str,
    faiss_index,
    embed_model: SentenceTransformer,
    docs,
    bm25: BM25Okapi,
    semantic_k: int = 30,
    bm25_k: int = 30,
    rrf_k: int = 60,
    top_k: int = 15,
) -> List[int]:
    """Return list of doc indices (top_k) after RRF fusion."""
    q_emb = embed_model.encode([query], normalize_embeddings=True).astype(np.float32)
    # FAISS
    sem_scores, sem_idxs = faiss_index.search(q_emb, semantic_k)
    sem_idxs = sem_idxs[0]
    candidates = {}
    for rank, idx in enumerate(sem_idxs, start=1):
        if idx >= 0:
            candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)
    # BM25
    tokens = _bm25_tokenize(query)
    if tokens:
        bm25_scores_full = np.asarray(bm25.get_scores(tokens), dtype=np.float32)
        bm25_top = np.argsort(-bm25_scores_full)[:bm25_k]
        for rank, idx in enumerate(bm25_top, start=1):
            if idx >= 0:
                candidates[idx] = candidates.get(idx, 0.0) + rrf_score(rank, rrf_k)
    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    return [idx for idx, _ in sorted_candidates[:top_k]]

# ----------------------------------------------------------------------
# (Optional) Reranking
# ----------------------------------------------------------------------
def rerank_docs(query: str, doc_indices: List[int], docs, reranker, top_k: int) -> List[int]:
    """Re‑order doc indices using cross‑encoder, return top_k."""
    if not doc_indices or reranker is None:
        return doc_indices[:top_k]
    pairs = [[query, docs[i]["content"]] for i in doc_indices]
    scores = reranker.predict(pairs)
    # Sort by score descending
    indexed = list(zip(doc_indices, scores))
    indexed.sort(key=lambda x: x[1], reverse=True)
    return [i for i, _ in indexed[:top_k]]

# ----------------------------------------------------------------------
# Evaluation metrics (unchanged)
# ----------------------------------------------------------------------
def recall_at_k(retrieved_idxs, docs, gold_chunk_ids=None):
    if not gold_chunk_ids:
        return None
    denom = len(gold_chunk_ids)
    ret_chunk_ids = [docs[i].get("id") for i in retrieved_idxs]
    hits = len(set(ret_chunk_ids).intersection(set(gold_chunk_ids)))
    return hits / denom if denom else None

def mrr(retrieved_idxs, docs, gold_chunk_ids=None):
    if not gold_chunk_ids:
        return None
    gold_set = set(gold_chunk_ids)
    for rank, i in enumerate(retrieved_idxs, start=1):
        if docs[i].get("id") in gold_set:
            return 1.0 / rank
    return 0.0

def simple_f1(pred: str, gold: str) -> float:
    pt = set(_normalize_arabic(pred).split())
    gt = set(_normalize_arabic(gold).split())
    if not pt or not gt:
        return 0.0
    inter = len(pt.intersection(gt))
    p = inter / len(pt)
    r = inter / len(gt)
    return 0.0 if (p + r) == 0 else 2 * p * r / (p + r)

# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Evaluate RAG pipeline (RRF + optional reranking).")
    ap.add_argument("--store", type=str, default="rag_store")
    ap.add_argument("--test_jsonl", type=str, required=True)
    ap.add_argument("--k", type=int, default=5, help="Top-k retrieved docs for evaluation")
    ap.add_argument("--semantic_k", type=int, default=30, help="FAISS candidates")
    ap.add_argument("--bm25_k", type=int, default=30, help="BM25 candidates")
    ap.add_argument("--faiss_candidates", type=int, default=80, help="(deprecated) use --semantic_k")
    ap.add_argument("--bm25_candidates", type=int, default=80, help="(deprecated) use --bm25_k")
    ap.add_argument("--embed_model", type=str, default="Omartificial-Intelligence-Space/mmbert-base-arabic-nli")
    ap.add_argument("--pred_answers_jsonl", type=str, default="", help="Optional JSONL with generated answers")
    ap.add_argument("--use_rerank", action="store_true", help="Enable cross‑encoder reranking (slower but more precise)")
    ap.add_argument("--reranker_model", type=str, default="Omartificial-Intelligence-Space/ARA-Reranker-V1")
    args = ap.parse_args()

    store = Path(args.store)
    faiss_index = faiss.read_index(str(store / "index.faiss"))
    with (store / "docstore.json").open("r", encoding="utf-8") as f:
        docs = json.load(f)

    bm25_path = store / "bm25.pkl"
    if not bm25_path.exists():
        raise SystemExit(f"BM25 not found. Rebuild with --build_bm25")
    with bm25_path.open("rb") as f:
        payload = pickle.load(f)
    bm25 = payload.get("bm25")
    if bm25 is None or not isinstance(bm25, BM25Okapi):
        raise SystemExit("Invalid bm25.pkl payload.")

    embed_model = SentenceTransformer(args.embed_model)

    # Reranker (if requested)
    reranker = None
    if args.use_rerank:
        reranker = CrossEncoder(args.reranker_model)

    test_path = Path(args.test_jsonl)
    rows = []
    with test_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))

    # Read predicted answers if provided
    pred_map = {}
    if args.pred_answers_jsonl:
        with Path(args.pred_answers_jsonl).open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                r = json.loads(line)
                pred_map[str(r.get("query", ""))] = str(r.get("pred_answer", ""))

    recalls = []
    mrrs = []
    f1s = []

    # Use candidate counts (defaults: semantic_k, bm25_k)
    sem_k = args.semantic_k if args.semantic_k else args.faiss_candidates
    bm_k = args.bm25_k if args.bm25_k else args.bm25_candidates

    for r in rows:
        q = str(r.get("query", "")).strip()
        if not q:
            continue

        # 1) Retrieve using RRF (get more than k for possible reranking)
        retrieved_indices = hybrid_retrieve_rrf(
            query=q,
            faiss_index=faiss_index,
            embed_model=embed_model,
            docs=docs,
            bm25=bm25,
            semantic_k=sem_k,
            bm25_k=bm_k,
            rrf_k=60,
            top_k=args.k * 2 if args.use_rerank else args.k,   # get extra for reranking
        )

        # 2) Optional reranking
        if args.use_rerank and reranker and len(retrieved_indices) > args.k:
            retrieved_indices = rerank_docs(q, retrieved_indices, docs, reranker, args.k)
        else:
            retrieved_indices = retrieved_indices[:args.k]

        # Compute retrieval metrics
        rec = recall_at_k(retrieved_indices, docs, r.get("gold_source_ids"), r.get("gold_chunk_ids"))
        if rec is not None:
            recalls.append(rec)
        rr = mrr(retrieved_indices, docs, r.get("gold_source_ids"), r.get("gold_chunk_ids"))
        if rr is not None:
            mrrs.append(rr)

        # Generation metric (if answers provided)
        gold_ans = r.get("gold_answer")
        if gold_ans and pred_map:
            pred = pred_map.get(q, "")
            if pred:
                f1s.append(simple_f1(pred, str(gold_ans)))

    def avg(xs):
        return float(np.mean(xs)) if xs else None

    print("=== Eval summary ===")
    if recalls:
        print(f"Recall@{args.k}: {avg(recalls):.4f} (n={len(recalls)})")
    else:
        print(f"Recall@{args.k}: n/a (missing gold ids in test set)")
    if mrrs:
        print(f"MRR@{args.k}:    {avg(mrrs):.4f} (n={len(mrrs)})")
    else:
        print(f"MRR@{args.k}:    n/a (missing gold ids)")
    if f1s:
        print(f"Answer F1:        {avg(f1s):.4f} (n={len(f1s)})")
    else:
        print("Answer F1:    n/a (provide --pred_answers_jsonl and gold_answer)")

if __name__ == "__main__":
    main()