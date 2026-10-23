"""Unsupervised baseline: frames close to their cluster centroid are 'representative'.

score_t = 1 - (distance to own centroid / max distance), per video. No labels are used.
It rewards typical content, not necessarily interesting content, so expect it to be weak;
it exists to show how much the supervised model adds.
"""
from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans


def kmeans_scores(features: np.ndarray, n_clusters: int | None = None, seed: int = 0) -> np.ndarray:
    t = features.shape[0]
    k = n_clusters or max(2, int(round(np.sqrt(t))))
    k = min(k, t)
    km = KMeans(n_clusters=k, n_init=5, random_state=seed).fit(features)
    d = np.linalg.norm(features - km.cluster_centers_[km.labels_], axis=1)
    return (1.0 - d / (d.max() + 1e-12)).astype(np.float32)
