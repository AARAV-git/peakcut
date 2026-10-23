"""NumPy reference implementations used to test the PyTorch losses on small inputs.
Inputs: logits/labels/mask of shape (B, T); mask True = real frame."""
from __future__ import annotations

import numpy as np


def bce_ref(logits, labels, mask, smoothing: float = 0.0) -> float:
    y = labels * (1 - smoothing) + 0.5 * smoothing
    per = np.maximum(logits, 0) - logits * y + np.log1p(np.exp(-np.abs(logits)))
    return float((per * mask).sum() / max(mask.sum(), 1))


def ranking_ref(logits, labels, mask, margin: float = 1.0) -> float:
    total, n = 0.0, 0
    for b in range(logits.shape[0]):
        pos = np.where(mask[b] & (labels[b] > 0.5))[0]
        neg = np.where(mask[b] & (labels[b] <= 0.5))[0]
        for i in pos:
            for j in neg:
                total += max(0.0, margin - (logits[b, i] - logits[b, j]))
                n += 1
    return total / max(n, 1)


def contrastive_ref(logits, labels, mask, tau: float = 0.5) -> float:
    total, n = 0.0, 0
    for b in range(logits.shape[0]):
        s = logits[b] / tau
        pos = np.where(mask[b] & (labels[b] > 0.5))[0]
        neg = np.where(mask[b] & (labels[b] <= 0.5))[0]
        for i in pos:
            neg_lse = np.log(np.exp(s[neg]).sum()) if len(neg) else -np.inf
            total += np.logaddexp(0.0, neg_lse - s[i])
            n += 1
    return total / max(n, 1)
