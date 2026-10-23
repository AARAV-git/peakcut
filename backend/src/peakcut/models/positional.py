"""Fixed sinusoidal positional encoding shared by the PyTorch and JAX models."""
from __future__ import annotations

import numpy as np


def sinusoidal(length: int, dim: int) -> np.ndarray:
    pos = np.arange(length)[:, None]
    i = np.arange(0, dim, 2)[None, :]
    angle = pos / np.power(10000.0, i / dim)
    pe = np.zeros((length, dim), dtype=np.float32)
    pe[:, 0::2] = np.sin(angle)
    pe[:, 1::2] = np.cos(angle[:, : dim // 2])
    return pe
