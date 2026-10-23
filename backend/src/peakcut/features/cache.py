"""Save/load cached frame embeddings so extraction runs once per video."""
from __future__ import annotations

from pathlib import Path

import numpy as np


def save_features(path: str | Path, features: np.ndarray) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.save(path, np.asarray(features, dtype=np.float32))
    return path


def load_features(path: str | Path) -> np.ndarray:
    return np.load(path)
