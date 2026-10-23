"""Logic behind the routes."""
from __future__ import annotations

import hashlib
import tempfile
from pathlib import Path

import numpy as np

from peakcut.db.repository import Repository
from peakcut.eval.segments import fixed_segments, select_segments

SUMMARY_VARIANT_PREFERENCE = ("captions+asr", "captions", "few_shot")


class ServiceError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def known_video_highlights(repo: Repository, video_id: str, run_id: str | None) -> dict:
    video = repo.get_video(video_id)
    if video is None:
        raise ServiceError(404, f"Unknown video_id '{video_id}'")
    run = run_id or repo.best_run_id()
    if run is None:
        raise ServiceError(404, "No evaluated runs with highlights in the database")
    if not repo.run_exists(run):
        raise ServiceError(404, f"Unknown run_id '{run}'")
    scores = repo.get_predictions(run, video_id)
    if not scores:
        raise ServiceError(404, f"Run '{run}' has no predictions for video '{video_id}'")
    return {
        "video_id": video_id,
        "run_id": run,
        "sample_rate": video["sample_rate"],
        "scores": scores,
        "highlights": repo.get_highlights(run, video_id),
    }


def upload_highlights(state, data: bytes, filename: str, seg_len: int, budget: float) -> dict:
    """Score an uploaded video with the injected extractor and scorer. Not persisted."""
    if state.extractor is None or state.scorer is None:
        raise ServiceError(501, "Upload scoring is not available: feature extractor/scorer not loaded")
    if len(data) > state.cfg.api.max_upload_mb * 1024 * 1024:
        raise ServiceError(413, f"File larger than {state.cfg.api.max_upload_mb} MB")
    suffix = Path(filename or "video.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            features, duration, _ = state.extractor.extract(tmp.name)
        except Exception as exc:  # decoding failures surface as a client error
            raise ServiceError(422, f"Could not process video: {exc}") from exc
    scores = np.asarray(state.scorer(features), dtype=np.float64)
    t = len(scores)
    rate = t / duration
    vid = "upload_" + hashlib.sha1(data).hexdigest()[:8]
    segs = select_segments(scores, fixed_segments(t, seg_len), budget)
    return {
        "video_id": vid,
        "run_id": "upload",
        "sample_rate": rate,
        "scores": scores.tolist(),
        "highlights": [
            {
                "highlight_id": f"{vid}:{k}",
                "start_sec": s / rate,
                "end_sec": (e + 1) / rate,
                "start_idx": s,
                "end_idx": e,
                "score": sc,
            }
            for k, (s, e, sc) in enumerate(segs)
        ],
    }


def summaries(repo: Repository, highlight_ids: list[str], variant: str | None) -> list[dict]:
    if any(h.startswith("upload_") for h in highlight_ids):
        raise ServiceError(501, "Titles/summaries for uploaded videos are not implemented")
    rows = repo.get_summaries(highlight_ids)
    by_h: dict[str, list[dict]] = {}
    for r in rows:
        by_h.setdefault(r["highlight_id"], []).append(r)
    out = []
    for hid in highlight_ids:
        options = by_h.get(hid, [])
        if variant:
            options = [o for o in options if o["prompt_variant"] == variant]
        if not options:
            continue
        options.sort(
            key=lambda o: SUMMARY_VARIANT_PREFERENCE.index(o["prompt_variant"])
            if o["prompt_variant"] in SUMMARY_VARIANT_PREFERENCE
            else 99
        )
        out.append(options[0])
    return out
