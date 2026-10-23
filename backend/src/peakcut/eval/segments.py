"""Turn frame scores into a summary: segments, 0/1 knapsack selection under a budget."""
from __future__ import annotations

import numpy as np


def fixed_segments(n_samples: int, seg_len: int = 5) -> np.ndarray:
    """Contiguous inclusive [start, end] segments of seg_len samples (last may be shorter)."""
    starts = np.arange(0, n_samples, seg_len)
    ends = np.minimum(starts + seg_len - 1, n_samples - 1)
    return np.stack([starts, ends], axis=1).astype(np.int64)


def segments_from_starts(starts, n_samples: int) -> np.ndarray:
    """Build contiguous inclusive segments from a list of start indices."""
    s = np.unique(np.clip(np.asarray(starts, dtype=np.int64), 0, n_samples - 1))
    if len(s) == 0 or s[0] != 0:
        s = np.concatenate([[0], s])
    e = np.concatenate([s[1:] - 1, [n_samples - 1]])
    return np.stack([s, e], axis=1)


def _minmax(x: np.ndarray) -> np.ndarray:
    lo, hi = float(x.min()), float(x.max())
    return np.zeros_like(x, dtype=np.float64) if hi - lo < 1e-12 else (x - lo) / (hi - lo)


def knapsack(values: np.ndarray, weights: np.ndarray, capacity: int) -> list[int]:
    """0/1 knapsack (max total value, total weight <= capacity). Returns chosen indices."""
    n = len(values)
    if n == 0 or capacity <= 0:
        return []
    best = np.zeros((n + 1, capacity + 1))
    take = np.zeros((n, capacity + 1), dtype=bool)
    for i in range(n):
        w, v = int(weights[i]), float(values[i])
        best[i + 1] = best[i]
        if w <= capacity:
            cand = best[i, : capacity + 1 - w] + v
            better = cand > best[i, w:]
            best[i + 1, w:] = np.where(better, cand, best[i, w:])
            take[i, w:] = better
    chosen, c = [], capacity
    for i in range(n - 1, -1, -1):
        if take[i, c]:
            chosen.append(i)
            c -= int(weights[i])
    return sorted(chosen)


def select_segments(
    scores: np.ndarray, change_points: np.ndarray, budget_ratio: float = 0.15
) -> list[tuple[int, int, float]]:
    """Pick segments maximising summed mean-score under a length budget.

    Returns (start_idx, end_idx, mean_score) tuples, inclusive indices, sorted by start.
    If no whole segment fits the budget, the best segment is truncated to the budget.
    """
    scores = np.asarray(scores, dtype=np.float64)
    t = len(scores)
    cps = np.asarray(change_points)
    norm = _minmax(scores)
    lengths = (cps[:, 1] - cps[:, 0] + 1).astype(int)
    means = np.array([norm[s : e + 1].mean() for s, e in cps])
    capacity = int(np.floor(budget_ratio * t))
    chosen = knapsack(means, lengths, capacity)
    if not chosen and capacity >= 1 and norm.max() > 0:
        k = int(np.argmax(means))
        s = int(cps[k, 0])
        return [(s, min(int(cps[k, 1]), s + capacity - 1), float(means[k]))]
    return [(int(cps[k, 0]), int(cps[k, 1]), float(means[k])) for k in chosen]


def segments_to_mask(segments, n_samples: int) -> np.ndarray:
    mask = np.zeros(n_samples, dtype=bool)
    for s, e, *_ in segments:
        mask[s : e + 1] = True
    return mask
