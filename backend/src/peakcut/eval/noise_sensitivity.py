"""Metric vs injected label-noise level."""
from __future__ import annotations

from collections.abc import Callable, Sequence

import numpy as np

from peakcut.config import EvalCfg
from peakcut.data.common import VideoRecord

from .runner import evaluate_records


def noise_sweep(
    records: Sequence[VideoRecord],
    run_fn: Callable[[float], dict[str, np.ndarray]],
    noise_levels: Sequence[float],
    cfg: EvalCfg,
) -> list[dict]:
    """run_fn(noise) -> scores_by_id (e.g. a cross-validated training run at that noise).
    Evaluation always uses the clean annotator-derived labels."""
    out = []
    for noise in noise_levels:
        res = evaluate_records(records, run_fn(noise), cfg)
        out.append({"label_noise": float(noise), **res["overall"]})
    return out
