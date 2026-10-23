
from peakcut.data.h5_format import load_kts_h5
from peakcut.data.synthetic import make_synthetic_dataset, write_kts_h5


def test_kts_roundtrip(tmp_path):
    recs = make_synthetic_dataset(3, n_annotators=4, dim=8, seed=2)
    write_kts_h5(recs, tmp_path / "x.h5")
    back = load_kts_h5(tmp_path / "x.h5", "tvsum", categories={"synthetic_000": "BK"})
    assert len(back) == 3
    r0, b0 = recs[0], back[0]
    assert b0.features.shape == r0.features.shape
    assert b0.user_scores.shape == r0.user_scores.shape
    assert (b0.user_scores == (r0.user_scores > 0.5)).all()
    assert b0.category == "BK" and back[1].category is None
    # segments are contiguous and cover every sample
    cp = b0.change_points
    assert cp[0, 0] == 0 and cp[-1, 1] == b0.n_samples - 1
    assert (cp[1:, 0] == cp[:-1, 1] + 1).all()
