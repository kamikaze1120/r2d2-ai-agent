"""Shared LLM helper for agents.

Wraps the existing OllamaClient with a JSON-coerce helper so each agent can
ask the LLM for structured output without re-implementing parsing.
"""
from __future__ import annotations
import json
import re
from ..llm import OllamaClient


_JSON_RE = re.compile(r"\{.*\}|\[.*\]", re.DOTALL)


async def llm_json(prompt: str, *, system: str = "",
                   model: str | None = None) -> dict | list | None:
    client = OllamaClient()
    try:
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.append({"role": "user",
                     "content": prompt + "\n\nReply with ONLY valid JSON."})
        raw = await client.chat(msgs, model=model, temperature=0.4)
    finally:
        await client.aclose()
    if not raw:
        return None
    raw = raw.strip().strip("`")
    raw = re.sub(r"^json", "", raw, flags=re.I).strip()
    m = _JSON_RE.search(raw)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def llm_text(prompt: str, *, system: str = "",
                   model: str | None = None) -> str:
    client = OllamaClient()
    try:
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.append({"role": "user", "content": prompt})
        return (await client.chat(msgs, model=model, temperature=0.7) or "").strip()
    finally:
        await client.aclose()
