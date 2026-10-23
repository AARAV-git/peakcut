import numpy as np

from peakcut.training.noise import confident_learning_flags, inject_label_noise, relabel


def test_inject_flips_exact_count_and_is_reproducible():
    y = np.zeros(100, np.float32)
    a = inject_label_noise(y, 0.2, np.random.default_rng(0))
    b = inject_label_noise(y, 0.2, np.random.default_rng(0))
    assert (a != y).sum() == 20 and (a == b).all()


def test_zero_noise_is_identity():
    y = np.array([0, 1, 1], np.float32)
    assert (inject_label_noise(y, 0.0, np.random.default_rng(0)) == y).all()


def test_confident_learning_finds_flipped_labels():
    rng = np.random.default_rng(0)
    truth = (rng.random(400) < 0.3).astype(float)
    probs = np.clip(truth * 0.8 + 0.1 + rng.normal(0, 0.05, 400), 0, 1)   # informative, out-of-sample-like
    noisy = inject_label_noise(truth.astype(np.float32), 0.1, np.random.default_rng(1))
    flagged = confident_learning_flags(probs, noisy)
    fixed = relabel(noisy, flagged)
    assert (fixed != truth).sum() < (noisy != truth).sum() * 0.5
