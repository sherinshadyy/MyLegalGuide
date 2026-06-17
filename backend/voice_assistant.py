#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Local microphone voice assistant (CLI) — Egyptian Arabic STT + optional RAG chat.

Requires: pip install -r requirements-voice.txt
Also needs ffmpeg on PATH for some audio formats.

Usage (from backend/):
  python voice_assistant.py
  python voice_assistant.py --seconds 6 --ask-rag
"""

from __future__ import annotations

import argparse
import os
import sys
import wave

import numpy as np
import requests
import sounddevice as sd
from arabic_reshaper import reshape
from bidi.algorithm import get_display

from voice_stt import transcribe_audio_bytes, voice_stt_config


def _print_ar(text: str) -> None:
    try:
        print(get_display(reshape(text)))
    except Exception:
        print(text)


def record_wav(seconds: float, sample_rate: int = 16000) -> bytes:
    print(f"Recording {seconds:.0f}s — speak in Egyptian Arabic…")
    audio = sd.rec(int(seconds * sample_rate), samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()
    pcm = (np.clip(audio, -1.0, 1.0)[:, 0] * 32767).astype(np.int16)
    import io

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def ask_rag(question: str) -> str:
    base = os.getenv("RAG_API_URL", "http://127.0.0.1:8000").rstrip("/")
    res = requests.post(
        f"{base}/chat",
        json={"message": question, "history": []},
        timeout=120,
    )
    res.raise_for_status()
    data = res.json()
    return str(data.get("reply") or "")


def main() -> None:
    ap = argparse.ArgumentParser(description="Egyptian Arabic voice assistant (local mic)")
    ap.add_argument("--seconds", type=float, default=5.0, help="Recording length")
    ap.add_argument("--ask-rag", action="store_true", help="Send transcript to RAG /chat")
    args = ap.parse_args()

    if not voice_stt_config()["enabled"]:
        print("VOICE_STT_ENABLED=0 — enable in .env to use voice.", file=sys.stderr)
        sys.exit(1)

    wav_bytes = record_wav(args.seconds)
    result = transcribe_audio_bytes(wav_bytes, mime_type="audio/wav", lang="ar-EG")

    print("\n--- Heard (transcript) ---")
    _print_ar(result["text"])
    if result.get("normalized") and result["normalized"] != result["text"]:
        print("\n--- Normalized for search ---")
        _print_ar(result["normalized"])

    if args.ask_rag:
        q = result["text"] or result.get("normalized") or ""
        if not q:
            return
        print("\n--- RAG reply ---")
        try:
            reply = ask_rag(q)
            _print_ar(reply)
        except Exception as exc:
            print(f"RAG error: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
