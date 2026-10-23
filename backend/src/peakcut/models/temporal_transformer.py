"""PyTorch temporal transformer: frame embeddings (B, T, D) -> per-frame logits (B, T).

Pre-norm blocks written out explicitly (no nn.MultiheadAttention) so the JAX port in
jax_transformer.py is a line-for-line match and weights convert exactly.
"""
from __future__ import annotations

import math

import torch
import torch.nn.functional as F
from torch import nn

from .positional import sinusoidal

NEG_INF = -1e9


class Block(nn.Module):
    def __init__(self, d: int, heads: int, mlp_ratio: int, dropout: float):
        super().__init__()
        self.heads = heads
        self.ln1 = nn.LayerNorm(d, eps=1e-5)
        self.q, self.k, self.v, self.o = (nn.Linear(d, d) for _ in range(4))
        self.ln2 = nn.LayerNorm(d, eps=1e-5)
        self.fc1 = nn.Linear(d, d * mlp_ratio)
        self.fc2 = nn.Linear(d * mlp_ratio, d)
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        b, t, d = x.shape
        h = self.heads
        y = self.ln1(x)
        split = lambda z: z.view(b, t, h, d // h).transpose(1, 2)  # noqa: E731
        q, k, v = split(self.q(y)), split(self.k(y)), split(self.v(y))
        att = (q @ k.transpose(-1, -2)) / math.sqrt(d // h)
        att = att.masked_fill(~mask[:, None, None, :], NEG_INF)
        att = self.drop(torch.softmax(att, dim=-1))
        out = (att @ v).transpose(1, 2).reshape(b, t, d)
        x = x + self.drop(self.o(out))
        y = self.ln2(x)
        return x + self.drop(self.fc2(F.gelu(self.fc1(y))))


class TemporalTransformer(nn.Module):
    def __init__(
        self,
        in_dim: int,
        d_model: int = 128,
        n_heads: int = 4,
        n_layers: int = 2,
        mlp_ratio: int = 2,
        dropout: float = 0.1,
        max_len: int = 2048,
    ):
        super().__init__()
        self.config = dict(
            in_dim=in_dim, d_model=d_model, n_heads=n_heads, n_layers=n_layers,
            mlp_ratio=mlp_ratio, dropout=dropout, max_len=max_len,
        )
        self.in_proj = nn.Linear(in_dim, d_model)
        self.register_buffer("pos", torch.from_numpy(sinusoidal(max_len, d_model)), persistent=False)
        self.blocks = nn.ModuleList(Block(d_model, n_heads, mlp_ratio, dropout) for _ in range(n_layers))
        self.final_ln = nn.LayerNorm(d_model, eps=1e-5)
        self.head = nn.Linear(d_model, 1)

    def forward(self, x: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        t = x.shape[1]
        h = self.in_proj(x) + self.pos[:t]
        for blk in self.blocks:
            h = blk(h, mask)
        return self.head(self.final_ln(h)).squeeze(-1)
