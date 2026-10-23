"""Pairwise hinge ranking loss: every highlight frame should outscore every non-highlight
frame in the same video by at least `margin`."""
from __future__ import annotations

import torch


def ranking_loss(logits: torch.Tensor, labels: torch.Tensor, mask: torch.Tensor, margin: float = 1.0):
    pos = mask & (labels > 0.5)
    neg = mask & (labels <= 0.5)
    diff = logits[:, :, None] - logits[:, None, :]          # (B, T, T): s_i - s_j
    pair = pos[:, :, None] & neg[:, None, :]
    hinge = torch.relu(margin - diff)
    return (hinge * pair).sum() / pair.sum().clamp(min=1)
