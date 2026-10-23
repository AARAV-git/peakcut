"""Loss registry. All losses share the signature loss(logits, labels, mask) -> scalar."""
from __future__ import annotations

from collections.abc import Callable

from peakcut.config import TrainCfg


def get_loss(cfg: TrainCfg) -> Callable:
    from .bce import bce_loss
    from .contrastive import contrastive_loss
    from .ranking import ranking_loss

    if cfg.loss == "bce":
        return lambda lg, y, m: bce_loss(lg, y, m, smoothing=cfg.label_smoothing)
    if cfg.loss == "ranking":
        return lambda lg, y, m: ranking_loss(lg, y, m, margin=cfg.margin)
    if cfg.loss == "contrastive":
        return lambda lg, y, m: contrastive_loss(lg, y, m, tau=cfg.tau)
    raise ValueError(f"Unknown loss '{cfg.loss}' (expected bce | ranking | contrastive)")
