"""Shared LLM helpers for sub-agents.

Wraps LLMClient with JSON-coerce logic so agents can request structured
output without re-implementing parsing.
"""
from __future__ import annotations
import json
import re
from ..llm import LLMClient


_FENCE_RE  = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)
_OBJECT_RE = re.compile(r"\{(?:[^{}]|\{[^{}]*\})*\}", re.DOTALL)
_ARRAY_RE  = re.compile(r"\[.*\]", re.DOTALL)


def _extract(raw: str) -> dict | list | None:
    raw = raw.strip()
    fence = _FENCE_RE.search(raw)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass
    for pattern in (_OBJECT_RE, _ARRAY_RE):
        for m in pattern.finditer(raw):
            try:
                return json.loads(m.group(0))
            except Exception:
                continue
    try:
        return json.loads(raw)
    except Exception:
        return None


async def llm_json(prompt: str, *, system: str = "",
                   model: str | None = None) -> dict | list | None:
    """Call the active LLM and parse the response as JSON."""
    client = LLMClient()
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user",
                 "content": prompt + "\n\nReply with ONLY valid JSON. No prose, no fences."})
    raw = await client.chat(msgs, model=model, temperature=0.3)
    return _extract(raw or "")


async def llm_text(prompt: str, *, system: str = "",
                   model: str | None = None) -> str:
    """Call the active LLM and return plain text."""
    client = LLMClient()
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    return (await client.chat(msgs, model=model, temperature=0.7) or "").strip()
