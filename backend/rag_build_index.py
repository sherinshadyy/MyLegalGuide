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


def _load_chunks(path: Path):
    """Load chunks from JSON file that uses 'chunked_id', 'content', 'num_items'.
    'source_ids' is not required and will be set to empty list."""
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    chunks = []
    for ch in data:
        if not isinstance(ch, dict):
            continue
        # Use 'chunked_id' as primary id; fallback to 'id' if present
        chunk_id = str(ch.get("chunked_id", ch.get("id", "")))
        content = str(ch.get("content", "")).strip()
        if not content:
            continue
        num_items = int(ch.get("num_items", 1))
        chunks.append(
            {
                "id": chunk_id,
                "source_ids": [],          # not used, kept for compatibility
                "num_items": num_items,
                "content": content,
            }
        )
    return chunks


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


def main():
    ap = argparse.ArgumentParser(description="Build FAISS index for RAG from chunked_data.json")
    ap.add_argument("--chunks", type=str, default="chunked_data.json", help="Path to chunked_data.json")
    ap.add_argument(
        "--model",
        type=str,
        default="Omartificial-Intelligence-Space/mmbert-base-arabic-nli",
        help="SentenceTransformer model name",
    )
    ap.add_argument("--out_dir", type=str, default="rag_store", help="Output directory")
    ap.add_argument("--batch_size", type=int, default=32)
    ap.add_argument("--use_hnsw", action="store_true", help="Use HNSW index (faster queries, approximate)")
    ap.add_argument("--hnsw_m", type=int, default=32, help="HNSW M (only if --use_hnsw)")
    ap.add_argument("--build_bm25", action="store_true", help="Also build BM25 index and persist it")
    args = ap.parse_args()

    chunks_path = Path(args.chunks)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    chunks = _load_chunks(chunks_path)
    if not chunks:
        raise SystemExit(f"No chunks found in {chunks_path}")

    texts = [c["content"] for c in chunks]

    model = SentenceTransformer(args.model)
    embeddings = model.encode(
        texts,
        batch_size=args.batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    ).astype(np.float32)

    dim = int(embeddings.shape[1])
    if args.use_hnsw:
        index = faiss.IndexHNSWFlat(dim, args.hnsw_m, faiss.METRIC_INNER_PRODUCT)
        index.hnsw.efConstruction = 200
        index.hnsw.efSearch = 64
    else:
        index = faiss.IndexFlatIP(dim)

    index.add(embeddings)

    # Persist
    faiss.write_index(index, str(out_dir / "index.faiss"))
    np.save(out_dir / "embeddings.npy", embeddings)

    # docstore: row i corresponds to vector i
    with (out_dir / "docstore.json").open("w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    if args.build_bm25:
        tokenized_corpus = [_bm25_tokenize(t) for t in texts]
        bm25 = BM25Okapi(tokenized_corpus)
        with (out_dir / "bm25.pkl").open("wb") as f:
            pickle.dump(
                {
                    "bm25": bm25,
                    "tokenizer": "simple_arabic_normalize_split",
                },
                f,
                protocol=pickle.HIGHEST_PROTOCOL,
            )

    meta = {
        "model": args.model,
        "normalize_embeddings": True,
        "metric": "inner_product",
        "count": len(chunks),
        "dim": dim,
        "has_bm25": bool(args.build_bm25),
    }
    with (out_dir / "meta.json").open("w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"Saved FAISS index to: {out_dir / 'index.faiss'}")
    print(f"Saved docstore to:   {out_dir / 'docstore.json'}")
    print(f"Saved meta to:       {out_dir / 'meta.json'}")
    if args.build_bm25:
        print(f"Saved BM25 index to:  {out_dir / 'bm25.pkl'}")


if __name__ == "__main__":
    main()