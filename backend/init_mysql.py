#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
from pathlib import Path

import db

if __name__ == "__main__":
    db.init_db()

    store = Path(os.getenv("RAG_STORE", "rag_store"))
    docstore_path = store / "docstore.json"
    if docstore_path.exists():
        count = db.sync_json_docstore_to_db(docstore_path)
        print(f"Imported {count} documents into MySQL table rag_docs.")
    else:
        print(f"Docstore file not found at {docstore_path}. No docs imported.")

    frontend_data_path = Path(__file__).resolve().parents[1] / "frontend" / "legalguide-data.json"
    if frontend_data_path.exists():
        counts = db.sync_frontend_data_to_db(frontend_data_path)
        print(f"Imported frontend data into MySQL: {counts}")
    else:
        print(f"Frontend data file not found at {frontend_data_path}. No user/admin/booking data imported.")

    print("MySQL initialization complete.")
