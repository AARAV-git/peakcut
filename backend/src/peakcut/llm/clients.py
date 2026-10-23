"""LLM clients behind one tiny interface so the pipeline is testable offline."""
from __future__ import annotations

import os
from collections.abc import Callable
from typing import Protocol


class LLMClient(Protocol):
    model: str

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 300) -> str: ...


class MockLLM:
    """Deterministic stand-in. Output is NOT a real model result; stored with model='mock'."""

    model = "mock"

    def __init__(self, responder: Callable[[str], str] | None = None):
        self.responder = responder or self._default
        self.calls: list[str] = []

    @staticmethod
    def _default(prompt: str) -> str:
        return '{"title": "Highlight", "summary": "A highlighted moment from the video."}'

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 300) -> str:
        self.calls.append(prompt)
        return self.responder(prompt)


class AnthropicLLM:
    """Needs `pip install anthropic` and ANTHROPIC_API_KEY in the environment."""

    def __init__(self, model: str):
        import anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self.model = model
        self._client = anthropic.Anthropic()

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 300) -> str:
        kwargs = {"system": system} if system else {}
        msg = self._client.messages.create(
            model=self.model, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}], **kwargs
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")


def get_client(provider: str, model: str) -> LLMClient:
    if provider == "anthropic":
        return AnthropicLLM(model)
    if provider == "mock":
        return MockLLM()
    raise ValueError(f"Unknown LLM provider '{provider}'")
