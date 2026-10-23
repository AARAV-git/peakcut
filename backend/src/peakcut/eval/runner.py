"""Score -> summary -> metrics -> database. Shared by scripts and tests."""
from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from peakcut.config import EvalCfg
from peakcut.data.common import VideoRecord, binary_labels, consensus

from .metrics import average_precision, summary_f1, user_summaries
from .segments import segments_to_mask, select_segments
from .subgroup import group_metrics, mean_metrics


def evaluate_video(record: VideoRecord, scores: np.ndarray, cfg: EvalCfg, rule: str | None = None) -> dict:
    segs = select_segments(scores, record.change_points, cfg.budget_ratio)
    pred_mask = segments_to_mask(segs, record.n_samples)
    gts = user_summaries(record.user_scores, record.change_points, cfg.budget_ratio)
    labels = binary_labels(consensus(record.user_scores), cfg.label_positive_ratio)
    return {
        "video_id": record.video_id,
        "f1": summary_f1(pred_mask, gts, rule or ("max" if record.dataset == "summe" else cfg.f1_rule)),
        "map": average_precision(scores, labels),
        "segments": segs,
    }


def evaluate_records(
    records: Sequence[VideoRecord], scores_by_id: dict[str, np.ndarray], cfg: EvalCfg
) -> dict:
    per_video = [evaluate_video(r, scores_by_id[r.video_id], cfg) for r in records]
    cats = {r.video_id: r.category for r in records}
    return {
        "per_video": per_video,
        "overall": mean_metrics(per_video),
        "by_category": group_metrics(per_video, cats),
    }


def persist_run(
    repo,
    run_id: str,
    framework: str,
    loss: str | None,
    label_noise: float,
    seed: int,
    config: dict,
    records: Sequence[VideoRecord],
    scores_by_id: dict[str, np.ndarray],
    cfg: EvalCfg,
) -> dict:
    """Evaluate predictions and write experiment, predictions, metrics and highlights."""
    result = evaluate_records(records, scores_by_id, cfg)
    repo.save_experiment(run_id, framework, loss, label_noise, seed, config)
    repo.save_predictions(run_id, {r.video_id: scores_by_id[r.video_id] for r in records})

    rows = [(run_id, "overall", "", result["overall"]["f1"], result["overall"]["map"])]
    rows += [(run_id, "category", c, m["f1"], m["map"]) for c, m in result["by_category"].items()]
    rows += [(run_id, "video", v["video_id"], v["f1"], v["map"]) for v in result["per_video"]]
    repo.save_metrics(rows)

    by_id = {r.video_id: r for r in records}
    hl = []
    for v in result["per_video"]:
        rec = by_id[v["video_id"]]
        for k, (s, e, sc) in enumerate(v["segments"]):
            hl.append(
                (
                    f"{run_id}:{rec.video_id}:{k}",
                    run_id,
                    rec.video_id,
                    s / rec.sample_rate,
                    (e + 1) / rec.sample_rate,
                    int(s),
                    int(e),
                    float(sc),
                )
            )
    if hl:
        repo.save_highlights(hl)
    return result
