"""Lexical hallucination heuristic: content words in the generated text that appear in
neither the captions nor the transcript. A cheap, transparent baseline; it misses
paraphrases and cannot catch wrong relations, which is why the LLM judge is a second signal."""
from __future__ import annotations

import re

STOP = set(
    "a an the and or of in on at to for with from by is are was were be been being this that these those "
    "it its as into over under after before while during video clip scene shows showing highlight moment "
    "then than their there they them his her he she we you i not no but if so very more most some any".split()
)


def _words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3 and w not in STOP]


def _supported(word: str, source: set[str]) -> bool:
    stem = word[:5]
    return any(s.startswith(stem) or word.startswith(s[:5]) for s in source)


def flag_hallucination(
    title: str,
    summary: str,
    captions: list[str],
    transcript: str | None = None,
    threshold: float = 0.4,
) -> tuple[bool, list[str]]:
    """Returns (hallucinated, unsupported_words). Flagged when more than `threshold` of the
    generated content words are unsupported by the source text."""
    source = set(_words(" ".join(captions) + " " + (transcript or "")))
    generated = _words(f"{title} {summary}")
    if not generated:
        return False, []
    unsupported = sorted({w for w in generated if not _supported(w, source)})
    ratio = sum(1 for w in generated if w in unsupported) / len(generated)
    return ratio > threshold, unsupported
