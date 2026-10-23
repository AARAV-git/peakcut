"""Listwise InfoNCE over frame scores: each highlight frame is contrasted against all
non-highlight frames of the same video.  loss_i = -log( e^{s_i/t} / (e^{s_i/t} + sum_neg e^{s_j/t}) )"""
from __future__ import annotations

import torch
import torch.nn.functional as F


def contrastive_loss(logits: torch.Tensor, labels: torch.Tensor, mask: torch.Tensor, tau: float = 0.5):
    s = logits / tau
    pos = mask & (labels > 0.5)
    neg = mask & (labels <= 0.5)
    neg_lse = torch.logsumexp(s.masked_fill(~neg, float("-inf")), dim=1, keepdim=True)   # (B, 1)
    per = F.softplus(neg_lse - s)                                                         # (B, T)
    return (per * pos).sum() / pos.sum().clamp(min=1)
