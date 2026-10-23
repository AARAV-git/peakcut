"""Prompt variants for highlight titles/summaries and the judge rubric."""
from __future__ import annotations

SYSTEM = (
    "You write short titles and summaries for video highlights. Use ONLY facts present in the "
    "provided frame captions (and transcript, if given). Do not invent people, places or events. "
    'Reply with a single JSON object: {"title": "...", "summary": "..."}. '
    "Title: at most 8 words. Summary: one or two sentences."
)

FEW_SHOT = (
    "Example\nCaptions: a man holds a surfboard on a beach | a wave lifts a surfer | a surfer rides a wave\n"
    'Answer: {"title": "Surfer rides a wave", "summary": "A surfer paddles out and rides a wave near the shore."}\n\n'
    "Example\nCaptions: a cat sits on a sofa | a cat jumps onto a table | a cat knocks a glass over\n"
    'Answer: {"title": "Cat knocks glass off table", "summary": "A cat jumps onto a table and knocks a glass over."}\n\n'
)

VARIANTS = ("captions", "captions+asr", "few_shot")


def build_summary_prompt(variant: str, captions: list[str], transcript: str | None = None) -> str:
    if variant not in VARIANTS:
        raise ValueError(f"Unknown prompt variant '{variant}'")
    cap = " | ".join(captions)
    prompt = f"Captions: {cap}\n"
    if variant == "captions+asr":
        prompt += f"Transcript: {transcript or '(none)'}\n"
    if variant == "few_shot":
        prompt = FEW_SHOT + "Now this one\n" + prompt
    return prompt + "Answer:"


JUDGE_SYSTEM = (
    "You grade a generated video-highlight title and summary against the source captions. "
    'Reply with a single JSON object: {"faithfulness": 1-5, "informativeness": 1-5}. '
    "faithfulness: 5 = every claim supported by the captions, 1 = mostly unsupported or invented. "
    "informativeness: 5 = captures the main event clearly, 1 = vague or generic."
)


def build_judge_prompt(captions: list[str], title: str, summary: str) -> str:
    return f"Captions: {' | '.join(captions)}\nTitle: {title}\nSummary: {summary}\nGrade:"
