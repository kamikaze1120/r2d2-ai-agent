"""Ollama client. Talks to a locally running Ollama daemon."""
from __future__ import annotations
import httpx
from typing import AsyncIterator
from . import config


class OllamaClient:
    def __init__(self, host: str | None = None):
        self.host = host or config.OLLAMA_HOST
        self._client = httpx.AsyncClient(base_url=self.host, timeout=300.0)

    async def list_models(self) -> list[dict]:
        r = await self._client.get("/api/tags")
        r.raise_for_status()
        return r.json().get("models", [])

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
    ) -> str:
        payload = {
            "model": model or config.DEFAULT_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        r = await self._client.post("/api/chat", json=payload)
        r.raise_for_status()
        return r.json()["message"]["content"]

    async def chat_stream(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
    ) -> AsyncIterator[str]:
        payload = {
            "model": model or config.DEFAULT_MODEL,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        async with self._client.stream("POST", "/api/chat", json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.strip():
                    continue
                import json as _json
                try:
                    chunk = _json.loads(line)
                except Exception:
                    continue
                msg = chunk.get("message", {}).get("content", "")
                if msg:
                    yield msg
                if chunk.get("done"):
                    break

    async def aclose(self):
        await self._client.aclose()
