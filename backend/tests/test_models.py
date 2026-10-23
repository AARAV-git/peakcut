import numpy as np
import pytest

from peakcut.data.dataset import pad_batch
from peakcut.models.positional import sinusoidal


def test_sinusoidal_shape_and_range():
    pe = sinusoidal(10, 8)
    assert pe.shape == (10, 8) and np.abs(pe).max() <= 1.0


def test_pad_batch_masks_real_frames():
    a = (np.ones((3, 4), np.float32), np.ones(3, np.float32), "a")
    b = (np.ones((5, 4), np.float32), np.zeros(5, np.float32), "b")
    out = pad_batch([a, b])
    assert out["features"].shape == (2, 5, 4)
    assert out["mask"].sum(axis=1).tolist() == [3, 5]


def _jax():
    pytest.importorskip("jax")
    from peakcut.models import jax_transformer as jt

    return jt


def test_jax_shapes_and_padding_invariance():
    jt = _jax()
    import jax

    params = jt.init_params(jax.random.PRNGKey(0), in_dim=8, d_model=16, n_layers=2)
    x = np.random.default_rng(0).normal(size=(1, 6, 8)).astype(np.float32)
    short = jt.apply(params, x, np.ones((1, 6), bool), n_heads=4)
    xp = np.concatenate([x, np.random.default_rng(1).normal(size=(1, 4, 8)).astype(np.float32)], axis=1)
    mp = np.array([[True] * 6 + [False] * 4])
    padded = jt.apply(params, xp, mp, n_heads=4)
    assert short.shape == (1, 6)
    np.testing.assert_allclose(np.asarray(short), np.asarray(padded)[:, :6], atol=1e-5)


def test_jax_train_step_reduces_loss():
    jt = _jax()
    import jax

    rng = np.random.default_rng(0)
    x = rng.normal(size=(4, 20, 8)).astype(np.float32)
    y = (x[..., 0] > 0).astype(np.float32)
    m = np.ones((4, 20), bool)
    params = jt.init_params(jax.random.PRNGKey(0), 8, 16, 1)
    step, opt = jt.make_train_step(n_heads=4, lr=3e-3)
    state = opt.init(params)
    first = None
    for _ in range(60):
        params, state, loss = step(params, state, x, y, m)
        first = float(loss) if first is None else first
    assert float(loss) < first * 0.7


def test_torch_jax_parity():
    jt = _jax()
    torch = pytest.importorskip("torch")
    from peakcut.models.temporal_transformer import TemporalTransformer

    torch.manual_seed(0)
    model = TemporalTransformer(8, d_model=16, n_heads=4, n_layers=2, dropout=0.0).eval()
    x = np.random.default_rng(0).normal(size=(2, 9, 8)).astype(np.float32)
    mask = np.array([[True] * 9, [True] * 6 + [False] * 3])
    with torch.no_grad():
        ref = model(torch.from_numpy(x), torch.from_numpy(mask)).numpy()
    out = np.asarray(jt.apply(jt.from_torch_state_dict(model.state_dict()), x, mask, n_heads=4))
    np.testing.assert_allclose(out[mask], ref[mask], atol=1e-4)


def test_torch_model_shapes():
    torch = pytest.importorskip("torch")
    from peakcut.models.temporal_transformer import TemporalTransformer

    m = TemporalTransformer(8, d_model=16, n_heads=4, n_layers=1).eval()
    out = m(torch.randn(2, 7, 8), torch.ones(2, 7, dtype=torch.bool))
    assert out.shape == (2, 7)
