"""F1 (summary vs annotator summaries) and average precision (scores vs consensus labels)."""
from __future__ import annotations

import numpy as np

from .segments import segments_to_mask, select_segments


def f1_score_frames(pred_mask: np.ndarray, gt_mask: np.ndarray) -> float:
    overlap = float(np.logical_and(pred_mask, gt_mask).sum())
    if overlap == 0:
        return 0.0
    precision = overlap / pred_mask.sum()
    recall = overlap / gt_mask.sum()
    return 2 * precision * recall / (precision + recall)


def average_precision(scores: np.ndarray, labels: np.ndarray) -> float:
    """Non-interpolated AP: mean of precision at the rank of each positive."""
    labels = np.asarray(labels).astype(bool)
    if labels.sum() == 0:
        return 0.0
    order = np.argsort(-np.asarray(scores, dtype=np.float64), kind="stable")
    hits = labels[order]
    precision_at_k = np.cumsum(hits) / (np.arange(len(hits)) + 1)
    return float(precision_at_k[hits].mean())


def user_summaries(user_scores: np.ndarray, change_points: np.ndarray, budget: float) -> np.ndarray:
    """Per-annotator binary summaries. Binary rows are used as-is; graded rows go through
    the same knapsack as predictions."""
    out = []
    for row in user_scores:
        if np.isin(row, (0, 1)).all():
            out.append(row > 0.5)
        else:
            out.append(segments_to_mask(select_segments(row, change_points, budget), len(row)))
    return np.stack(out)


def summary_f1(pred_mask: np.ndarray, gt_masks: np.ndarray, rule: str = "avg") -> float:
    f1s = np.array([f1_score_frames(pred_mask, g) for g in gt_masks])
    return float(f1s.max() if rule == "max" else f1s.mean())
