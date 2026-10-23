"""FastAPI app factory. The API only ever opens the database read-only."""
from __future__ import annotations

import logging
import os
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from peakcut.config import Config, load_config
from peakcut.db.connection import connect

from .routes import router

log = logging.getLogger("peakcut.api")


def _default_extractor_and_scorer(cfg: Config):
    """Best effort: CLIP extractor, and the PyTorch checkpoint if present else k-means.
    Returns (None, None) when the optional ML dependencies are not installed."""
    try:
        from peakcut.features.extractor import ClipExtractor

        extractor = ClipExtractor(cfg.features.embedding_model, cfg.features.sample_fps, cfg.features.batch_size)
    except Exception as exc:  # missing torch/transformers or no model access
        log.warning("Upload scoring disabled (extractor unavailable): %s", exc)
        return None, None
    ckpt = Path(cfg.api.checkpoint)
    if ckpt.exists():
        import torch

        from peakcut.training.trainer import load_checkpoint

        model = load_checkpoint(ckpt)

        def scorer(features: np.ndarray) -> np.ndarray:
            with torch.no_grad():
                x = torch.from_numpy(features[None])
                m = torch.ones(1, features.shape[0], dtype=torch.bool)
                return model(x, m)[0].numpy()

        return extractor, scorer
    from peakcut.models.kmeans_baseline import kmeans_scores

    log.warning("No checkpoint at %s; uploads fall back to the unsupervised k-means baseline", ckpt)
    return extractor, lambda f: kmeans_scores(f, seed=cfg.seed)


def create_app(
    db_path: str | Path | None = None,
    cfg: Config | None = None,
    extractor=None,
    scorer: Callable[[np.ndarray], np.ndarray] | None = None,
    auto_load_models: bool = True,
) -> FastAPI:
    cfg = cfg or load_config()
    db = db_path or os.environ.get("PEAKCUT_DB") or cfg.paths.db_path
    if auto_load_models and extractor is None and scorer is None:
        extractor, scorer = _default_extractor_and_scorer(cfg)

    con = connect(db, read_only=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        con.close()

    app = FastAPI(title="Peakcut API", version="0.1.0", lifespan=lifespan)
    app.state.con, app.state.cfg = con, cfg
    app.state.extractor, app.state.scorer = extractor, scorer
    app.add_middleware(
        CORSMiddleware, allow_origins=cfg.api.cors_origins, allow_methods=["*"], allow_headers=["*"]
    )
    app.include_router(router)
    return app
