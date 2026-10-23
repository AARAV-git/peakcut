import numpy as np
import pytest

from peakcut.eval.metrics import average_precision, f1_score_frames, summary_f1, user_summaries


def test_f1_hand_computed():
    pred = np.array([1, 1, 0, 0], bool)
    gt = np.array([1, 0, 1, 0], bool)
    assert f1_score_frames(pred, gt) == pytest.approx(0.5)


def test_f1_no_overlap_is_zero():
    assert f1_score_frames(np.array([1, 0], bool), np.array([0, 1], bool)) == 0.0


def test_average_precision_hand_computed():
    # ranking: idx0 (pos), idx1 (neg), idx2 (pos) -> precisions 1/1 and 2/3
    ap = average_precision(np.array([0.9, 0.8, 0.1]), np.array([1, 0, 1]))
    assert ap == pytest.approx((1 + 2 / 3) / 2)


def test_average_precision_perfect_and_empty():
    assert average_precision(np.array([3, 2, 1.0]), np.array([1, 1, 0])) == pytest.approx(1.0)
    assert average_precision(np.array([3, 2, 1.0]), np.array([0, 0, 0])) == 0.0


def test_summary_f1_rules():
    pred = np.array([1, 1, 0, 0], bool)
    gts = np.array([[1, 1, 0, 0], [0, 0, 1, 1]], bool)
    assert summary_f1(pred, gts, "max") == pytest.approx(1.0)
    assert summary_f1(pred, gts, "avg") == pytest.approx(0.5)


def test_user_summaries_binary_rows_pass_through():
    cps = np.array([[0, 1], [2, 3]])
    rows = np.array([[1, 0, 0, 1]], dtype=np.float32)
    assert (user_summaries(rows, cps, 0.5) == rows.astype(bool)).all()
