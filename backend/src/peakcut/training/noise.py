"""Label noise: synthetic injection and a confident-learning-style relabeller (numpy only)."""
from __future__ import annotations

import numpy as np


def inject_label_noise(labels: np.ndarray, rate: float, rng: np.random.Generator) -> np.ndarray:
    """Flip exactly round(rate * len) binary labels, chosen uniformly at random."""
    out = labels.copy()
    n = int(round(rate * len(labels)))
    if n > 0:
        idx = rng.choice(len(labels), size=n, replace=False)
        out[idx] = 1.0 - out[idx]
    return out


def confident_learning_flags(probs: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Binary confident-learning rule using out-of-sample positive-class probabilities.

    Per-class threshold t_c = mean P(class c) over examples labelled c. An example is flagged
    when it is confidently predicted (P >= t_c) as a class different from its given label.
    """
    probs = np.asarray(probs, dtype=np.float64)
    labels = np.asarray(labels).astype(int)
    p1, p0 = probs, 1.0 - probs
    if (labels == 1).sum() == 0 or (labels == 0).sum() == 0:
        return np.zeros(len(labels), dtype=bool)
    t1, t0 = p1[labels == 1].mean(), p0[labels == 0].mean()
    conf1, conf0 = p1 >= t1, p0 >= t0
    assigned = np.full(len(labels), -1)
    assigned[conf1 & ~conf0] = 1
    assigned[conf0 & ~conf1] = 0
    both = conf1 & conf0
    assigned[both] = (p1[both] > p0[both]).astype(int)
    return (assigned != -1) & (assigned != labels)


def relabel(labels: np.ndarray, flagged: np.ndarray) -> np.ndarray:
    out = labels.copy()
    out[flagged] = 1.0 - out[flagged]
    return out
