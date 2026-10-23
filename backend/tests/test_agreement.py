import numpy as np
import pytest

from peakcut.data.agreement import flag_low_quartile, pairwise_agreement


def test_identical_annotators_agree_perfectly():
    x = np.tile(np.arange(10.0), (3, 1))
    mean, n = pairwise_agreement(x)
    assert mean == pytest.approx(1.0) and n == 3


def test_constant_annotator_pairs_skipped():
    x = np.array([np.arange(10.0), np.arange(10.0), np.ones(10)])
    mean, n = pairwise_agreement(x)
    assert n == 1 and mean == pytest.approx(1.0)


def test_sql_matches_numpy(repo, records):
    rows = {r["video_id"]: r for r in repo._rows("SELECT * FROM annotator_agreement")}
    py = {r.video_id: pairwise_agreement(r.user_scores)[0] for r in records}
    for vid, val in py.items():
        assert rows[vid]["mean_corr"] == pytest.approx(val, abs=1e-9)
    flags = flag_low_quartile(py)
    assert {v: bool(rows[v]["high_disagreement"]) for v in py} == flags
