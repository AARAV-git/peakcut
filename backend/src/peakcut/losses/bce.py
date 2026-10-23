"""Binary cross-entropy on frame logits, with optional label smoothing."""
from __future__ import annotations

import torch
import torch.nn.functional as F


def bce_loss(logits: torch.Tensor, labels: torch.Tensor, mask: torch.Tensor, smoothing: float = 0.0):
    y = labels * (1 - smoothing) + 0.5 * smoothing
    per = F.binary_cross_entropy_with_logits(logits, y, reduction="none")
    m = mask.float()
    return (per * m).sum() / m.sum().clamp(min=1.0)
