#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Normalize user questions: Egyptian dialect, typos, missing punctuation."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Set

_AR_DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]")
_AR_TATWEEL_RE = re.compile(r"\u0640")
_AR_WHITESPACE_RE = re.compile(r"\s+")
# Keep Arabic letters and digits; drop Latin/punct (question marks etc.)
_AR_PUNCT_RE = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)

_ALEF_VARIANTS = str.maketrans({
    "\u0622": "\u0627",  # آ
    "\u0623": "\u0627",  # أ
    "\u0625": "\u0627",  # إ
    "\u0671": "\u0627",  # ٱ
})
_EASTERN_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# Egyptian colloquial → terms closer to legal/MSA corpus (longest phrases first)
_EGYPTIAN_LEXICON: List[tuple[str, str]] = sorted(
    [
        ("عايز اعرف", "أريد معرفة"),
        ("عاوز اعرف", "أريد معرفة"),
        ("عايز أعرف", "أريد معرفة"),
        ("عاوز أعرف", "أريد معرفة"),
        ("عايزه اعرف", "أريد معرفة"),
        ("عايزة اعرف", "أريد معرفة"),
        ("ممكن اعرف", "هل يمكن معرفة"),
        ("ينفع اعرف", "هل يمكن معرفة"),
        ("ايه هي", "ما هي"),
        ("إيه هي", "ما هي"),
        ("ايه هو", "ما هو"),
        ("إيه هو", "ما هو"),
        ("ايه عقوبة", "ما عقوبة"),
        ("إيه عقوبة", "ما عقوبة"),
        ("ايه حكم", "ما حكم"),
        ("إيه حكم", "ما حكم"),
        ("ازاي", "كيف"),
        ("إزاي", "كيف"),
        ("فين", "أين"),
        ("ليه", "لماذا"),
        ("لإيه", "لماذا"),
        ("كام", "كم"),
        ("عشان", "لأن"),
        ("علشان", "لأن"),
        ("عايز", "أريد"),
        ("عاوز", "أريد"),
        ("عايزه", "أريد"),
        ("عايزة", "أريد"),
        ("عاوزه", "أريد"),
        ("عاوزة", "أريد"),
        ("ممكن", "هل يمكن"),
        ("ينفع", "هل يجوز"),
        ("ايه", "ما"),
        ("إيه", "ما"),
        ("كده", "هكذا"),
        ("كدا", "هكذا"),
        ("بتاع", "الخاص ب"),
        ("بتاعة", "الخاصة ب"),
        ("النفقه", "النفقة"),
        ("نفقه", "نفقة"),
        ("حضانه", "حضانة"),
        ("طلاق", "الطلاق"),
        ("عقوبه", "عقوبة"),
        ("جنيه", "جنيه"),
        ("حبس", "حبس"),
        ("سجن", "سجن"),
        ("محكمه", "محكمة"),
        ("محامي", "محام"),
        ("قانون", "قانون"),
        ("ماده", "مادة"),
        ("مادة", "مادة"),
        ("اتجوز", "يتزوج"),
        ("يتجوز", "يتزوج"),
        ("يتجووز", "يتزوج"),
        ("يتطلق", "يطلق"),
        ("يتطلق", "يطلق"),
        ("يتحكم", "يحكم"),
        ("شكوى", "شكوى"),
        ("شكوي", "شكوى"),
    ],
    key=lambda x: len(x[0]),
    reverse=True,
)

# Common single-char / hamza typos in user input
_CHAR_TYPO_MAP = str.maketrans({
    "\u0629": "\u0647",  # ة → ه (variant for search)
})


def normalize_arabic(text: str) -> str:
    """Canonical form for BM25 / fuzzy matching."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(_EASTERN_DIGITS)
    text = _AR_TATWEEL_RE.sub("", text)
    text = _AR_DIACRITICS_RE.sub("", text)
    text = text.translate(_ALEF_VARIANTS)
    text = text.replace("\u0649", "\u064A")  # ى → ي
    text = _AR_PUNCT_RE.sub(" ", text)
    text = _AR_WHITESPACE_RE.sub(" ", text).strip()
    return text


def clean_user_question(raw: str) -> str:
    """Trim and lightly clean without destroying meaning."""
    text = (raw or "").strip()
    text = re.sub(r"[؟?!.،,;:]+$", "", text).strip()
    text = _AR_WHITESPACE_RE.sub(" ", text)
    return text


def apply_egyptian_lexicon(text: str) -> str:
    """Map Egyptian colloquial phrases toward MSA/legal wording."""
    out = text
    for src, dst in _EGYPTIAN_LEXICON:
        if src in out:
            out = out.replace(src, dst)
    return _AR_WHITESPACE_RE.sub(" ", out).strip()


def _typo_variant_ta_marbuta(text: str) -> str:
    """ة ↔ ه on word endings (common typo)."""
    words = text.split()
    alt = []
    for w in words:
        if w.endswith("\u0629"):
            alt.append(w[:-1] + "\u0647")
        elif w.endswith("\u0647") and len(w) > 2:
            alt.append(w[:-1] + "\u0629")
        else:
            alt.append(w)
    return " ".join(alt)


def prepare_search_queries(raw: str, max_variants: int = 5) -> List[str]:
    """
    Build multiple retrieval queries from one user message.
    Improves recall for dialect, typos, and missing '?'.
    """
    cleaned = clean_user_question(raw)
    if not cleaned:
        return []

    variants: List[str] = []
    seen: Set[str] = set()

    def _add(q: str) -> None:
        q = _AR_WHITESPACE_RE.sub(" ", (q or "").strip())
        if q and q not in seen and len(q) >= 2:
            seen.add(q)
            variants.append(q)

    norm = normalize_arabic(cleaned)
    msa = apply_egyptian_lexicon(norm)
    msa_norm = normalize_arabic(msa)

    _add(cleaned)
    _add(norm)
    _add(msa)
    _add(msa_norm)
    _add(_typo_variant_ta_marbuta(msa_norm))

    # Light typo map variant
    typo = normalize_arabic(cleaned.translate(_CHAR_TYPO_MAP))
    _add(typo)
    _add(apply_egyptian_lexicon(typo))

    return variants[:max_variants]


def prepare_user_question(raw: str) -> Dict[str, object]:
    """Package original text + search variants for RAG."""
    original = (raw or "").strip()
    cleaned = clean_user_question(original)
    search_queries = prepare_search_queries(original)
    if not search_queries and cleaned:
        search_queries = [cleaned]

    return {
        "original": original,
        "cleaned": cleaned or original,
        "search_queries": search_queries,
    }


# Back-compat for rag_answer / rag_build_index tokenizers
def bm25_tokenize(text: str) -> List[str]:
    norm = normalize_arabic(text)
    if not norm:
        return []
    return norm.split(" ")
