import itertools

import numpy as np

from peakcut.eval.segments import (
    fixed_segments,
    knapsack,
    segments_from_starts,
    segments_to_mask,
    select_segments,
)


def test_fixed_segments_cover_exactly():
    s = fixed_segments(12, 5)
    assert s.tolist() == [[0, 4], [5, 9], [10, 11]]


def test_segments_from_starts_contiguous():
    s = segments_from_starts([3, 7], 10)
    assert s.tolist() == [[0, 2], [3, 6], [7, 9]]


def test_knapsack_matches_brute_force():
    rng = np.random.default_rng(0)
    for _ in range(30):
        n = int(rng.integers(1, 8))
        v, w, cap = rng.random(n), rng.integers(1, 6, n), int(rng.integers(1, 15))
        best = max(
            (sum(v[i] for i in c) for r in range(n + 1) for c in itertools.combinations(range(n), r)
             if sum(w[i] for i in c) <= cap),
            default=0.0,
        )
        chosen = knapsack(v, w, cap)
        assert sum(w[i] for i in chosen) <= cap
        assert np.isclose(sum(v[i] for i in chosen), best)


def test_select_segments_respects_budget_and_picks_peak():
    scores = np.zeros(40)
    scores[10:15] = 1.0
    segs = select_segments(scores, fixed_segments(40, 5), budget_ratio=0.15)
    mask = segments_to_mask(segs, 40)
    assert mask.sum() <= int(0.15 * 40)
    assert mask[10:15].all()


def test_select_segments_truncates_when_nothing_fits():
    scores = np.zeros(20)
    scores[:10] = 1.0
    segs = select_segments(scores, np.array([[0, 9], [10, 19]]), budget_ratio=0.15)
    assert segments_to_mask(segs, 20).sum() == 3
