"""Typed configuration loaded from YAML files layered over defaults."""
from __future__ import annotations

import copy
import random
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

import numpy as np
import yaml


@dataclass
class PathsCfg:
    data_dir: str = "data"
    raw_dir: str = "data/raw"
    features_dir: str = "data/features"
    checkpoints_dir: str = "data/checkpoints"
    media_dir: str = "data/media"
    captions_dir: str = "data/captions"
    db_path: str = "data/db/peakcut.duckdb"


@dataclass
class FeaturesCfg:
    embedding_model: str = "openai/clip-vit-base-patch32"
    sample_fps: float = 2.0
    batch_size: int = 32


@dataclass
class EvalCfg:
    budget_ratio: float = 0.15
    label_positive_ratio: float = 0.15
    f1_rule: str = "avg"
    fixed_segment_len: int = 5


@dataclass
class TrainCfg:
    loss: str = "bce"
    epochs: int = 30
    lr: float = 1e-3
    weight_decay: float = 1e-4
    batch_size: int = 8
    d_model: int = 128
    n_heads: int = 4
    n_layers: int = 2
    dropout: float = 0.1
    label_smoothing: float = 0.0
    label_noise: float = 0.0
    tau: float = 0.5
    margin: float = 1.0
    folds: int = 5
    device: str = "auto"


@dataclass
class LLMCfg:
    provider: str = "anthropic"
    model: str = "claude-sonnet-5-5"
    max_tokens: int = 300
    prompt_variants: list[str] = field(
        default_factory=lambda: ["captions", "captions+asr", "few_shot"]
    )


@dataclass
class ApiCfg:
    checkpoint: str = "data/checkpoints/best.pt"
    max_upload_mb: int = 200
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])


@dataclass
class Config:
    seed: int = 42
    paths: PathsCfg = field(default_factory=PathsCfg)
    features: FeaturesCfg = field(default_factory=FeaturesCfg)
    evaluation: EvalCfg = field(default_factory=EvalCfg)
    train: TrainCfg = field(default_factory=TrainCfg)
    llm: LLMCfg = field(default_factory=LLMCfg)
    api: ApiCfg = field(default_factory=ApiCfg)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _apply(obj: Any, values: dict[str, Any], where: str = "") -> None:
    valid = {f.name for f in fields(obj)}
    for key, val in values.items():
        if key not in valid:
            raise KeyError(f"Unknown config key '{where}{key}'")
        cur = getattr(obj, key)
        if is_dataclass(cur) and isinstance(val, dict):
            _apply(cur, val, f"{where}{key}.")
        else:
            setattr(obj, key, copy.deepcopy(val))


def load_config(*paths: str | Path, overrides: dict[str, Any] | None = None) -> Config:
    """Load defaults, then each YAML file in order, then explicit overrides."""
    cfg = Config()
    for p in paths:
        with open(p) as fh:
            data = yaml.safe_load(fh) or {}
        _apply(cfg, data)
    if overrides:
        _apply(cfg, overrides)
    return cfg


def set_seed(seed: int) -> None:
    """Seed python, numpy and (if installed) torch."""
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch

        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass
