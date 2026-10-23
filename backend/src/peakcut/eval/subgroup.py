"""Per-category (subgroup) aggregation of per-video metrics."""
from __future__ import annotations

from collections import defaultdict

import numpy as np


def mean_metrics(rows: list[dict]) -> dict[str, float]:
    return {
        "f1": float(np.mean([r["f1"] for r in rows])) if rows else float("nan"),
        "map": float(np.mean([r["map"] for r in rows])) if rows else float("nan"),
    }


def group_metrics(per_video: list[dict], categories: dict[str, str | None]) -> dict[str, dict[str, float]]:
    """per_video rows: {video_id, f1, map}. Returns {category: {f1, map, n_videos}}."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in per_video:
        groups[categories.get(row["video_id"]) or "unknown"].append(row)
    return {c: {**mean_metrics(rows), "n_videos": len(rows)} for c, rows in sorted(groups.items())}
