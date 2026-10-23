import pytest

from peakcut.config import Config
from peakcut.eval.runner import persist_run
from peakcut.models.kmeans_baseline import kmeans_scores


@pytest.fixture
def two_runs(repo, records):
    cfg = Config()
    s0 = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
    s1 = {r.video_id: -s0[r.video_id] for r in records}   # deliberately worse
    a = persist_run(repo, "good", "kmeans", None, 0.0, 0, {}, records, s0, cfg.evaluation)
    b = persist_run(repo, "bad", "kmeans", None, 0.2, 0, {}, records, s1, cfg.evaluation)
    return a, b


def test_leaderboard_sorted_by_f1(repo, two_runs):
    rows = repo.leaderboard()
    assert [r["run_id"] for r in rows] == sorted(
        [r["run_id"] for r in rows], key=lambda i: -next(x["f1"] for x in rows if x["run_id"] == i)
    )
    assert {r["run_id"] for r in rows} == {"good", "bad"}


def test_per_category_sql_matches_python(repo, two_runs):
    a, _ = two_runs
    rows = {r["category"]: r for r in repo.run_sql_file("per_category_metrics.sql", ["good"])}
    for cat, m in a["by_category"].items():
        assert rows[cat]["f1"] == pytest.approx(m["f1"])
        assert rows[cat]["map"] == pytest.approx(m["map"])
        assert rows[cat]["n_videos"] == m["n_videos"]


def test_noise_sensitivity_groups_by_noise(repo, two_runs):
    rows = repo.run_sql_file("noise_sensitivity.sql", ["kmeans"])
    assert sorted(r["label_noise"] for r in rows) == [0.0, 0.2]


def test_best_run_ignores_noisy_runs(repo, two_runs):
    assert repo.best_run_id() == "good"
