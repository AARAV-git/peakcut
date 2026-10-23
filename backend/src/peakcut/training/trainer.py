"""PyTorch training: single fold, k-fold cross-validation, checkpoints.

Cross-validation gives every video exactly one out-of-fold prediction, which is what the
evaluation and the database store. Needs torch (pip install -e '.[train]').
"""
from __future__ import annotations

import numpy as np

from peakcut.config import Config, set_seed
from peakcut.data.common import VideoRecord, consensus_labels
from peakcut.data.dataset import VideoDataset, pad_batch

from .noise import confident_learning_flags, inject_label_noise, relabel


def resolve_device(name: str):
    import torch

    if name == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(name)


def kfold_splits(ids: list[str], k: int, seed: int) -> list[tuple[list[str], list[str]]]:
    """Deterministic shuffled k-fold. Returns [(train_ids, test_ids), ...]."""
    order = np.random.default_rng(seed).permutation(len(ids))
    folds = np.array_split(order, k)
    out = []
    for i in range(k):
        test = [ids[j] for j in folds[i]]
        train = [ids[j] for f in range(k) if f != i for j in folds[f]]
        out.append((train, test))
    return out


def build_targets(records: list[VideoRecord], cfg: Config, label_noise: float) -> dict[str, np.ndarray]:
    """Binary consensus labels; optional symmetric noise injected (training targets only)."""
    clean = consensus_labels(records, cfg.evaluation.label_positive_ratio)
    if label_noise <= 0:
        return clean
    rng = np.random.default_rng(cfg.seed + 1)
    return {v: inject_label_noise(y, label_noise, rng) for v, y in clean.items()}


def train_model(records: list[VideoRecord], targets: dict[str, np.ndarray], cfg: Config):
    import torch

    from peakcut.losses import get_loss
    from peakcut.models.temporal_transformer import TemporalTransformer

    set_seed(cfg.seed)
    tc, device = cfg.train, resolve_device(cfg.train.device)
    model = TemporalTransformer(
        records[0].features.shape[1], tc.d_model, tc.n_heads, tc.n_layers, dropout=tc.dropout
    ).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=tc.lr, weight_decay=tc.weight_decay)
    loss_fn = get_loss(tc)
    data = VideoDataset(records, targets)
    rng = np.random.default_rng(cfg.seed)
    model.train()
    for _ in range(tc.epochs):
        order = rng.permutation(len(data))
        for i in range(0, len(order), tc.batch_size):
            b = pad_batch([data[j] for j in order[i : i + tc.batch_size]])
            x = torch.from_numpy(b["features"]).to(device)
            y = torch.from_numpy(b["labels"]).to(device)
            m = torch.from_numpy(b["mask"]).to(device)
            loss = loss_fn(model(x, m), y, m)
            opt.zero_grad()
            loss.backward()
            opt.step()
    return model


def predict(model, records: list[VideoRecord], cfg: Config, probs: bool = False) -> dict[str, np.ndarray]:
    """Per-frame scores (logits, or probabilities when probs=True) for each record."""
    import torch

    device = resolve_device(cfg.train.device)
    model.eval()
    out = {}
    with torch.no_grad():
        for r in records:
            x = torch.from_numpy(r.features[None]).to(device)
            m = torch.ones(1, r.n_samples, dtype=torch.bool, device=device)
            lg = model(x, m)[0]
            out[r.video_id] = (torch.sigmoid(lg) if probs else lg).cpu().numpy()
    return out


def _relabel_targets(records, targets, cfg: Config) -> dict[str, np.ndarray]:
    """Inner 3-fold out-of-fold probabilities -> confident-learning flags -> flipped labels."""
    ids = [r.video_id for r in records]
    by_id = {r.video_id: r for r in records}
    oof: dict[str, np.ndarray] = {}
    for train_ids, test_ids in kfold_splits(ids, min(3, len(ids)), cfg.seed):
        model = train_model([by_id[i] for i in train_ids], targets, cfg)
        oof.update(predict(model, [by_id[i] for i in test_ids], cfg, probs=True))
    out = {}
    for v in ids:
        out[v] = relabel(targets[v], confident_learning_flags(oof[v], targets[v]))
    return out


def cross_validate(
    records: list[VideoRecord], cfg: Config, label_noise: float | None = None, use_relabel: bool = False
) -> dict[str, np.ndarray]:
    """Out-of-fold logits for every record."""
    noise = cfg.train.label_noise if label_noise is None else label_noise
    targets = build_targets(records, cfg, noise)
    by_id = {r.video_id: r for r in records}
    scores: dict[str, np.ndarray] = {}
    for train_ids, test_ids in kfold_splits([r.video_id for r in records], cfg.train.folds, cfg.seed):
        train = [by_id[i] for i in train_ids]
        tgt = _relabel_targets(train, targets, cfg) if use_relabel else targets
        model = train_model(train, tgt, cfg)
        scores.update(predict(model, [by_id[i] for i in test_ids], cfg))
    return scores


def save_checkpoint(model, path) -> None:
    from pathlib import Path

    import torch

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "config": model.config}, path)


def load_checkpoint(path, device: str = "cpu"):
    import torch

    from peakcut.models.temporal_transformer import TemporalTransformer

    ckpt = torch.load(path, map_location=device)
    model = TemporalTransformer(**ckpt["config"])
    model.load_state_dict(ckpt["state_dict"])
    return model.eval()
