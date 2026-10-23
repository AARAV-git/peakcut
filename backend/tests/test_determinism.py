import numpy as np

from peakcut.config import Config
from peakcut.data.synthetic import make_synthetic_dataset
from peakcut.eval.runner import evaluate_records
from peakcut.models.kmeans_baseline import kmeans_scores
from peakcut.training.trainer import kfold_splits


def test_synthetic_data_is_seeded():
    a, b = make_synthetic_dataset(4, seed=3), make_synthetic_dataset(4, seed=3)
    assert all((x.features == y.features).all() and (x.user_scores == y.user_scores).all() for x, y in zip(a, b))
    assert not np.array_equal(make_synthetic_dataset(4, seed=4)[0].features, a[0].features)


def test_same_seed_same_metrics(records):
    cfg = Config()
    runs = []
    for _ in range(2):
        scores = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
        runs.append(evaluate_records(records, scores, cfg.evaluation)["overall"])
    assert runs[0] == runs[1]


def test_kfold_partitions_every_video_once():
    ids = [f"v{i}" for i in range(11)]
    splits = kfold_splits(ids, 4, seed=0)
    tests = [i for _, t in splits for i in t]
    assert sorted(tests) == sorted(ids)
    for train, test in splits:
        assert not set(train) & set(test) and len(train) + len(test) == 11
    assert splits == kfold_splits(ids, 4, seed=0)
