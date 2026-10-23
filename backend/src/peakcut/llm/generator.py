"""Generate titles/summaries for stored highlights, judge them, flag hallucinations, save."""
from __future__ import annotations

import json
import re
from collections.abc import Callable, Sequence

from .clients import LLMClient
from .hallucination import flag_hallucination
from .prompts import JUDGE_SYSTEM, SYSTEM, build_judge_prompt, build_summary_prompt


def parse_json_object(text: str) -> dict | None:
    """Parse the first {...} block in an LLM reply; None if it is not valid JSON."""
    m = re.search(r"\{.*\}", text, flags=re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


def generate_summary(client: LLMClient, variant: str, captions: list[str], transcript: str | None = None):
    """Returns (title, summary) or None when the reply is unusable."""
    reply = client.complete(build_summary_prompt(variant, captions, transcript), system=SYSTEM)
    obj = parse_json_object(reply)
    if not obj or not isinstance(obj.get("title"), str) or not isinstance(obj.get("summary"), str):
        return None
    return obj["title"].strip(), obj["summary"].strip()


def judge_summary(client: LLMClient, captions: list[str], title: str, summary: str):
    """Returns (faithfulness, informativeness) in 1..5, or (None, None) on unusable reply."""
    obj = parse_json_object(client.complete(build_judge_prompt(captions, title, summary), system=JUDGE_SYSTEM))
    try:
        f, i = float(obj["faithfulness"]), float(obj["informativeness"])
    except (TypeError, KeyError, ValueError):
        return None, None
    return (f, i) if 1 <= f <= 5 and 1 <= i <= 5 else (None, None)


def captions_for_highlight(all_captions: Sequence[str], start_idx: int, end_idx: int, max_n: int = 8) -> list[str]:
    """Captions of the sampled frames inside the highlight, thinned to at most max_n."""
    seg = list(all_captions[start_idx : end_idx + 1])
    if len(seg) <= max_n:
        return seg
    step = len(seg) / max_n
    return [seg[int(i * step)] for i in range(max_n)]


def run_summary_pipeline(
    repo,
    run_id: str,
    captions_for_video: Callable[[str], Sequence[str] | None],
    client: LLMClient,
    judge: LLMClient | None = None,
    variants: Sequence[str] = ("captions",),
    transcript_for_video: Callable[[str], str | None] | None = None,
) -> dict[str, int]:
    """For every stored highlight of `run_id`: generate, judge, flag, save. Returns counters."""
    stats = {"generated": 0, "failed": 0, "skipped_no_captions": 0}
    cache: dict[str, Sequence[str] | None] = {}
    for h in repo.list_highlights(run_id):
        vid = h["video_id"]
        if vid not in cache:
            cache[vid] = captions_for_video(vid)
        if not cache[vid]:
            stats["skipped_no_captions"] += 1
            continue
        caps = captions_for_highlight(cache[vid], h["start_idx"], h["end_idx"])
        transcript = transcript_for_video(vid) if transcript_for_video else None
        for variant in variants:
            res = generate_summary(client, variant, caps, transcript)
            if res is None:
                stats["failed"] += 1
                continue
            title, summary = res
            repo.save_summary(h["highlight_id"], variant, client.model, title, summary)
            f, i = judge_summary(judge, caps, title, summary) if judge else (None, None)
            halluc, _ = flag_hallucination(title, summary, caps, transcript)
            repo.save_llm_eval(h["highlight_id"], variant, f, i, halluc)
            stats["generated"] += 1
    return stats
