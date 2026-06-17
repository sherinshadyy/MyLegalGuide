#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Rebuild FAISS + BM25 RAG index from backend/chunks.json.

Usage (from backend/):
  python rebuild_rag_index.py
  python rebuild_rag_index.py --use_hnsw
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    chunks = root / "chunks.json"
    out_dir = root / "rag_store"
    if not chunks.exists():
        raise SystemExit(f"Missing {chunks}. Build chunks.json first.")

    argv = [
        sys.argv[0],
        "--chunks",
        str(chunks),
        "--out_dir",
        str(out_dir),
        "--build_bm25",
        *sys.argv[1:],
    ]
    sys.argv = argv
    from rag_build_index import main as build_main

    build_main()


if __name__ == "__main__":
    main()
