#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Speech-to-text tuned for Egyptian Arabic (faster-whisper + dialect normalization)."""

from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from arabic_query import prepare_user_question

# Bias Whisper toward Egyptian colloquial legal speech (not formal MSA only).
_EGYPTIAN_WHISPER_PROMPT = (
    "محادثة بالعامية المصرية عن القانون في مصر. "
    "عايز اعرف، عاوز اسأل، إيه حقي، ازاي، فين، ليه، كام، "
    "الطلاق، النفقة، الحضانة، الميراث، الوصية، عقد جواز، عقد إيجار، "
    "المحامي، المحكمة، شكوى، جنحة، غرامة، حبس، استشارة قانونية."
)

_whisper_model = None
_whisper_lock = threading.Lock()
_whisper_error: Optional[str] = None
_whisper_loading = False


def voice_stt_config() -> Dict[str, Any]:
    return {
        "model": os.getenv("WHISPER_MODEL", "medium"),
        "device": os.getenv("WHISPER_DEVICE", "cpu"),
        "compute_type": os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        "enabled": os.getenv("VOICE_STT_ENABLED", "1").lower() not in ("0", "false", "no"),
    }


def _suffix_for_mime(mime: str) -> str:
    m = (mime or "").lower()
    if "webm" in m:
        return ".webm"
    if "ogg" in m:
        return ".ogg"
    if "mp4" in m or "m4a" in m:
        return ".m4a"
    if "wav" in m:
        return ".wav"
    if "mpeg" in m or "mp3" in m:
        return ".mp3"
    return ".webm"


def _get_whisper_model():
    global _whisper_model, _whisper_error, _whisper_loading
    if _whisper_model is not None:
        return _whisper_model
    if _whisper_error:
        raise RuntimeError(_whisper_error)
    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model
        if _whisper_error:
            raise RuntimeError(_whisper_error)
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            _whisper_error = (
                "faster-whisper is not installed. Run: pip install -r requirements-voice.txt"
            )
            raise RuntimeError(_whisper_error) from exc
        cfg = voice_stt_config()
        _whisper_loading = True
        try:
            print(f"[voice] Loading Whisper model ({cfg['model']})…")
            _whisper_model = WhisperModel(
                cfg["model"],
                device=cfg["device"],
                compute_type=cfg["compute_type"],
            )
            print(f"[voice] Whisper model ready ({cfg['model']})")
        except Exception as exc:
            _whisper_error = str(exc)
            raise
        finally:
            _whisper_loading = False
        return _whisper_model


def preload_whisper() -> None:
    """Optional warm-up on API startup."""
    if not voice_stt_config()["enabled"]:
        return
    try:
        _get_whisper_model()
    except Exception:
        pass


def whisper_ready() -> bool:
    return _whisper_model is not None and _whisper_error is None


def whisper_status() -> Dict[str, Any]:
    cfg = voice_stt_config()
    return {
        "enabled": cfg["enabled"],
        "ready": whisper_ready(),
        "loading": _whisper_loading,
        "model": cfg["model"],
        "device": cfg["device"],
        "error": _whisper_error,
    }


def transcribe_audio_bytes(
    data: bytes,
    mime_type: str = "audio/webm",
    lang: str = "ar",
) -> Dict[str, str]:
    """
    Transcribe audio and normalize Egyptian dialect for RAG/chat.
    Returns original transcript (for UI) plus normalized forms.
    """
    if not data or len(data) < 200:
        raise ValueError("Audio too short or empty")
    if len(data) > 12 * 1024 * 1024:
        raise ValueError("Audio too large (max ~12MB)")

    if not whisper_ready():
        if _whisper_loading:
            raise RuntimeError("Voice model still loading — try again in a minute")
        raise RuntimeError("Voice model not ready — use keyboard or wait for model download")

    model = _get_whisper_model()
    suffix = _suffix_for_mime(mime_type)
    lang_code = "ar" if str(lang or "").lower().startswith("ar") else (lang or "ar")

    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        segments, _info = model.transcribe(
            tmp_path,
            language=lang_code,
            initial_prompt=_EGYPTIAN_WHISPER_PROMPT,
            vad_filter=True,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            condition_on_previous_text=False,
            no_speech_threshold=0.5,
        )
        raw = "".join(seg.text for seg in segments).strip()
    finally:
        if tmp_path:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except OSError:
                pass

    if not raw:
        raise ValueError("No speech detected")

    prepared = prepare_user_question(raw)
    search_queries = prepared.get("search_queries") or []
    return {
        "text": str(prepared.get("original") or raw).strip(),
        "normalized": str(prepared.get("cleaned") or raw).strip(),
        "search_hint": str(search_queries[0]) if search_queries else "",
    }
