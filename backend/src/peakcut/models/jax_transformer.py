"""JAX port of TemporalTransformer (plain JAX, params as a pytree; optax only for training).

Same architecture as models/temporal_transformer.py, so PyTorch weights convert exactly
(see from_torch_state_dict) and outputs can be compared in tests/test_models.py.
"""
from __future__ import annotations

import re

import jax
import jax.numpy as jnp
import numpy as np

from .positional import sinusoidal

NEG_INF = -1e9


def _dense(key, fan_in: int, fan_out: int) -> dict:
    return {
        "w": jax.random.normal(key, (fan_in, fan_out)) / np.sqrt(fan_in),
        "b": jnp.zeros(fan_out),
    }


def _ln_params(d: int) -> dict:
    return {"g": jnp.ones(d), "b": jnp.zeros(d)}


def init_params(key, in_dim: int, d_model: int = 128, n_layers: int = 2, mlp_ratio: int = 2) -> dict:
    keys = jax.random.split(key, 2 + 6 * n_layers)
    params = {"in_proj": _dense(keys[0], in_dim, d_model), "blocks": []}
    for i in range(n_layers):
        k = keys[2 + 6 * i : 8 + 6 * i]
        params["blocks"].append(
            {
                "ln1": _ln_params(d_model),
                "q": _dense(k[0], d_model, d_model),
                "k": _dense(k[1], d_model, d_model),
                "v": _dense(k[2], d_model, d_model),
                "o": _dense(k[3], d_model, d_model),
                "ln2": _ln_params(d_model),
                "fc1": _dense(k[4], d_model, d_model * mlp_ratio),
                "fc2": _dense(k[5], d_model * mlp_ratio, d_model),
            }
        )
    params["final_ln"] = _ln_params(d_model)
    params["head"] = _dense(keys[1], d_model, 1)
    return params


def _ln(x, p, eps: float = 1e-5):
    mean = x.mean(-1, keepdims=True)
    var = ((x - mean) ** 2).mean(-1, keepdims=True)
    return (x - mean) / jnp.sqrt(var + eps) * p["g"] + p["b"]


def _lin(x, p):
    return x @ p["w"] + p["b"]


def _block(x, mask, p, n_heads: int):
    b, t, d = x.shape
    y = _ln(x, p["ln1"])
    split = lambda z: z.reshape(b, t, n_heads, d // n_heads).transpose(0, 2, 1, 3)  # noqa: E731
    q, k, v = split(_lin(y, p["q"])), split(_lin(y, p["k"])), split(_lin(y, p["v"]))
    att = (q @ k.transpose(0, 1, 3, 2)) / jnp.sqrt(d // n_heads)
    att = jnp.where(mask[:, None, None, :], att, NEG_INF)
    att = jax.nn.softmax(att, axis=-1)
    out = (att @ v).transpose(0, 2, 1, 3).reshape(b, t, d)
    x = x + _lin(out, p["o"])
    y = _ln(x, p["ln2"])
    return x + _lin(jax.nn.gelu(_lin(y, p["fc1"]), approximate=False), p["fc2"])


def apply(params: dict, x, mask, n_heads: int = 4):
    """x: (B, T, D) float, mask: (B, T) bool -> logits (B, T)."""
    d = params["in_proj"]["w"].shape[1]
    h = _lin(x, params["in_proj"]) + jnp.asarray(sinusoidal(x.shape[1], d))
    for blk in params["blocks"]:
        h = _block(h, mask, blk, n_heads)
    return _lin(_ln(h, params["final_ln"]), params["head"])[..., 0]


def from_torch_state_dict(sd: dict) -> dict:
    """Convert a TemporalTransformer state_dict (torch tensors or arrays) to JAX params."""
    g = lambda k: jnp.asarray(np.asarray(sd[k].detach().cpu().numpy() if hasattr(sd[k], "detach") else sd[k]))  # noqa: E731
    lin = lambda name: {"w": g(f"{name}.weight").T, "b": g(f"{name}.bias")}  # noqa: E731
    ln = lambda name: {"g": g(f"{name}.weight"), "b": g(f"{name}.bias")}  # noqa: E731
    n_layers = 1 + max(int(m.group(1)) for k in sd if (m := re.match(r"blocks\.(\d+)\.", k)))
    return {
        "in_proj": lin("in_proj"),
        "blocks": [
            {
                "ln1": ln(f"blocks.{i}.ln1"),
                "q": lin(f"blocks.{i}.q"),
                "k": lin(f"blocks.{i}.k"),
                "v": lin(f"blocks.{i}.v"),
                "o": lin(f"blocks.{i}.o"),
                "ln2": ln(f"blocks.{i}.ln2"),
                "fc1": lin(f"blocks.{i}.fc1"),
                "fc2": lin(f"blocks.{i}.fc2"),
            }
            for i in range(n_layers)
        ],
        "final_ln": ln("final_ln"),
        "head": lin("head"),
    }


def bce_with_logits(logits, labels, mask):
    per = jnp.maximum(logits, 0) - logits * labels + jnp.log1p(jnp.exp(-jnp.abs(logits)))
    m = mask.astype(per.dtype)
    return (per * m).sum() / jnp.maximum(m.sum(), 1.0)


def make_train_step(n_heads: int, lr: float):
    """Returns (jitted step, optimizer). BCE only: the JAX port exists for the parity and
    throughput comparison, not for the loss study."""
    import optax

    opt = optax.adam(lr)

    @jax.jit
    def step(params, opt_state, x, y, mask):
        loss, grads = jax.value_and_grad(lambda p: bce_with_logits(apply(p, x, mask, n_heads), y, mask))(params)
        updates, opt_state = opt.update(grads, opt_state, params)
        return optax.apply_updates(params, updates), opt_state, loss

    return step, opt
