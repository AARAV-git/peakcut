import duckdb
import numpy as np
import pytest

from peakcut.config import Config
from peakcut.db.connection import connect
from peakcut.eval.runner import persist_run
from peakcut.models.kmeans_baseline import kmeans_scores


def test_schema_has_all_tables(repo):
    names = {r[0] for r in repo.con.execute("SHOW TABLES").fetchall()}
    assert {"videos", "segments", "annotations", "annotator_agreement", "experiments", "predictions",
            "metrics", "highlights", "summaries", "llm_eval"} <= names


def test_records_roundtrip(repo, records):
    back = repo.load_records()
    assert [r.video_id for r in back] == sorted(r.video_id for r in records)
    orig = {r.video_id: r for r in records}
    for r in back:
        o = orig[r.video_id]
        assert r.features.shape == o.features.shape
        np.testing.assert_allclose(r.user_scores, o.user_scores, atol=1e-6)
        assert (r.change_points == o.change_points).all()
        assert r.category == o.category


def test_reload_replaces_instead_of_duplicating(repo, records):
    from peakcut.db.loader import load_records

    load_records(repo.con, records[:2])
    n = repo.con.execute("SELECT count(*) FROM videos WHERE video_id = ?", [records[0].video_id]).fetchone()[0]
    assert n == 1


def test_persist_run_and_no_orphans(repo, records):
    cfg = Config()
    scores = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
    res = persist_run(repo, "kmeans_s0", "kmeans", None, 0.0, 0, {"a": 1}, records, scores, cfg.evaluation)
    assert 0 <= res["overall"]["f1"] <= 1 and 0 <= res["overall"]["map"] <= 1
    # every child row points at an existing parent
    q = repo.con.execute
    assert q("SELECT count(*) FROM predictions p LEFT JOIN videos v USING (video_id) WHERE v.video_id IS NULL").fetchone()[0] == 0
    assert q("SELECT count(*) FROM highlights h LEFT JOIN experiments e USING (run_id) WHERE e.run_id IS NULL").fetchone()[0] == 0
    assert q("SELECT count(*) FROM metrics m LEFT JOIN experiments e USING (run_id) WHERE e.run_id IS NULL").fetchone()[0] == 0
    # one prediction per sampled frame
    n_pred = q("SELECT count(*) FROM predictions").fetchone()[0]
    assert n_pred == sum(r.n_samples for r in records)


def test_rerunning_a_run_replaces_it(repo, records):
    cfg = Config()
    scores = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
    for _ in range(2):
        persist_run(repo, "r1", "kmeans", None, 0.0, 0, {}, records, scores, cfg.evaluation)
    assert repo.con.execute("SELECT count(*) FROM experiments WHERE run_id='r1'").fetchone()[0] == 1
    assert repo.con.execute("SELECT count(*) FROM metrics WHERE run_id='r1' AND scope='overall'").fetchone()[0] == 1


def test_highlight_times_follow_sample_rate(repo, records):
    cfg = Config()
    scores = {r.video_id: kmeans_scores(r.features, seed=0) for r in records}
    persist_run(repo, "r1", "kmeans", None, 0.0, 0, {}, records, scores, cfg.evaluation)
    rec = {r.video_id: r for r in records}
    for h in repo.list_highlights("r1"):
        r = rec[h["video_id"]]
        assert h["start_sec"] == pytest.approx(h["start_idx"] / r.sample_rate)
        assert h["end_sec"] == pytest.approx((h["end_idx"] + 1) / r.sample_rate)
        assert h["end_sec"] <= r.duration_sec + 1e-9


def test_read_only_connection_rejects_writes(db_path):
    con = connect(db_path, read_only=True)
    with pytest.raises(duckdb.Error):
        con.execute("DELETE FROM videos")
    con.close()
