import numpy as np
import pytest

from peakcut.losses.reference import bce_ref, contrastive_ref, ranking_ref

LOGITS = np.array([[2.0, -1.0, 0.5, 0.0], [0.3, 1.2, -0.7, 0.0]])
LABELS = np.array([[1, 0, 1, 0], [0, 1, 0, 0]], dtype=np.float32)
MASK = np.array([[1, 1, 1, 1], [1, 1, 1, 0]], dtype=bool)


def test_reference_bce_known_value():
    # logit 0, label 0.5 -> log(2)
    v = bce_ref(np.zeros((1, 2)), np.array([[1.0, 0.0]]), np.ones((1, 2), bool), smoothing=1.0)
    assert v == pytest.approx(np.log(2))


def test_reference_ranking_known_value():
    # one pos (score 2), one neg (score 0), margin 1 -> no violation; margin 3 -> 1.0
    lg, y, m = np.array([[2.0, 0.0]]), np.array([[1.0, 0.0]]), np.ones((1, 2), bool)
    assert ranking_ref(lg, y, m, margin=1.0) == 0.0
    assert ranking_ref(lg, y, m, margin=3.0) == pytest.approx(1.0)


def test_reference_contrastive_known_value():
    # one pos, one neg at equal score: -log(e/(e+e)) = log 2 regardless of tau
    lg, y, m = np.array([[1.0, 1.0]]), np.array([[1.0, 0.0]]), np.ones((1, 2), bool)
    assert contrastive_ref(lg, y, m, tau=0.5) == pytest.approx(np.log(2))


def test_torch_losses_match_reference():
    torch = pytest.importorskip("torch")
    from peakcut.losses.bce import bce_loss
    from peakcut.losses.contrastive import contrastive_loss
    from peakcut.losses.ranking import ranking_loss

    lg, y, m = torch.tensor(LOGITS), torch.tensor(LABELS), torch.tensor(MASK)
    assert bce_loss(lg, y, m, 0.1).item() == pytest.approx(bce_ref(LOGITS, LABELS, MASK, 0.1), rel=1e-5)
    assert ranking_loss(lg, y, m, 1.0).item() == pytest.approx(ranking_ref(LOGITS, LABELS, MASK, 1.0), rel=1e-5)
    assert contrastive_loss(lg, y, m, 0.5).item() == pytest.approx(
        contrastive_ref(LOGITS, LABELS, MASK, 0.5), rel=1e-5
    )


def test_torch_losses_finite_without_negatives_or_positives():
    torch = pytest.importorskip("torch")
    from peakcut.losses.contrastive import contrastive_loss
    from peakcut.losses.ranking import ranking_loss

    lg = torch.zeros(1, 3)
    m = torch.ones(1, 3, dtype=torch.bool)
    for labels in (torch.ones(1, 3), torch.zeros(1, 3)):
        assert torch.isfinite(ranking_loss(lg, labels, m))
        assert torch.isfinite(contrastive_loss(lg, labels, m))
