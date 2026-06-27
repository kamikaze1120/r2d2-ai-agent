"""Unified LLM client — one interface, every provider.

Supports:
  - Ollama          (local, free)
  - Anthropic Claude (API)
  - OpenAI / GPT    (API)
  - Google Gemini   (API)
  - Custom          (any OpenAI-compatible endpoint: Groq, Together, LM Studio, etc.)

Usage:
    client = LLMClient()
    text   = await client.chat(messages, model="...", temperature=0.2)

    # token-by-token streaming
    async for token in client.chat_stream(messages):
        print(token, end="", flush=True)

Messages always use the OpenAI role format:
    [{"role": "system"|"user"|"assistant", "content": "..."}]
Conversion to provider-specific formats is handled internally.
"""
from __future__ import annotations
import json as _json
from typing import AsyncIterator
from . import config


class LLMClient:
    """Provider-agnostic async LLM client."""

    def __init__(self, provider: str | None = None):
        self.provider = (provider or config.LLM_PROVIDER).lower()

    # ── Public API ──────────────────────────────────────────────────────────

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
    ) -> str:
        """Return the full response as a string."""
        m = model or config.DEFAULT_MODEL
        if self.provider == "anthropic":
            return await self._anthropic(messages, m, temperature)
        if self.provider == "openai":
            return await self._openai(messages, m, temperature,
                                      base_url=config.OPENAI_BASE_URL,
                                      api_key=config.OPENAI_API_KEY)
        if self.provider == "gemini":
            return await self._gemini(messages, m, temperature)
        if self.provider == "custom":
            return await self._openai(messages, m, temperature,
                                      base_url=config.CUSTOM_LLM_BASE_URL,
                                      api_key=config.CUSTOM_LLM_API_KEY)
        # default: ollama
        return await self._ollama(messages, m, temperature)

    async def chat_stream(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.2,
    ) -> AsyncIterator[str]:
        """Yield tokens one at a time."""
        m = model or config.DEFAULT_MODEL
        if self.provider == "anthropic":
            async for tok in self._anthropic_stream(messages, m, temperature):
                yield tok
        elif self.provider == "openai":
            async for tok in self._openai_stream(messages, m, temperature,
                                                  base_url=config.OPENAI_BASE_URL,
                                                  api_key=config.OPENAI_API_KEY):
                yield tok
        elif self.provider == "gemini":
            async for tok in self._gemini_stream(messages, m, temperature):
                yield tok
        elif self.provider == "custom":
            async for tok in self._openai_stream(messages, m, temperature,
                                                  base_url=config.CUSTOM_LLM_BASE_URL,
                                                  api_key=config.CUSTOM_LLM_API_KEY):
                yield tok
        else:
            async for tok in self._ollama_stream(messages, m, temperature):
                yield tok

    async def list_models(self) -> list[str]:
        """Return available model names for the active provider."""
        if self.provider == "anthropic":
            return [
                "claude-sonnet-4-6",
                "claude-opus-4-8",
                "claude-haiku-4-5-20251001",
            ]
        if self.provider == "openai":
            return await self._openai_models(config.OPENAI_BASE_URL, config.OPENAI_API_KEY)
        if self.provider == "gemini":
            return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]
        if self.provider == "custom":
            return await self._openai_models(config.CUSTOM_LLM_BASE_URL, config.CUSTOM_LLM_API_KEY)
        # ollama
        return await self._ollama_models()

    def capability_tier(self) -> str:
        return config.get_capability_tier()

    # ── Ollama ──────────────────────────────────────────────────────────────

    async def _ollama(self, messages: list[dict], model: str, temperature: float) -> str:
        import httpx
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        async with httpx.AsyncClient(base_url=config.OLLAMA_HOST, timeout=300) as c:
            r = await c.post("/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"]

    async def _ollama_stream(self, messages: list[dict], model: str,
                             temperature: float) -> AsyncIterator[str]:
        import httpx
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        async with httpx.AsyncClient(base_url=config.OLLAMA_HOST, timeout=300) as c:
            async with c.stream("POST", "/api/chat", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = _json.loads(line)
                    except Exception:
                        continue
                    tok = chunk.get("message", {}).get("content", "")
                    if tok:
                        yield tok
                    if chunk.get("done"):
                        break

    async def _ollama_models(self) -> list[str]:
        import httpx
        try:
            async with httpx.AsyncClient(base_url=config.OLLAMA_HOST, timeout=10) as c:
                r = await c.get("/api/tags")
                r.raise_for_status()
                return [m.get("name", "") for m in r.json().get("models", [])]
        except Exception:
            return []

    # ── Anthropic Claude ────────────────────────────────────────────────────

    async def _anthropic(self, messages: list[dict], model: str, temperature: float) -> str:
        import anthropic
        key = config.ANTHROPIC_API_KEY
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        system, msgs = _split_system(messages)
        client = anthropic.AsyncAnthropic(api_key=key)
        resp = await client.messages.create(
            model=model,
            max_tokens=4096,
            system=system or anthropic.NOT_GIVEN,
            messages=msgs,
            temperature=temperature,
        )
        await client.close()
        return resp.content[0].text

    async def _anthropic_stream(self, messages: list[dict], model: str,
                                temperature: float) -> AsyncIterator[str]:
        import anthropic
        key = config.ANTHROPIC_API_KEY
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        system, msgs = _split_system(messages)
        client = anthropic.AsyncAnthropic(api_key=key)
        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=system or anthropic.NOT_GIVEN,
            messages=msgs,
            temperature=temperature,
        ) as stream:
            async for tok in stream.text_stream:
                yield tok
        await client.close()

    # ── OpenAI / compatible ─────────────────────────────────────────────────

    async def _openai(self, messages: list[dict], model: str, temperature: float,
                      base_url: str, api_key: str | None) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key or "not-needed", base_url=base_url)
        resp = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        await client.close()
        return resp.choices[0].message.content or ""

    async def _openai_stream(self, messages: list[dict], model: str, temperature: float,
                              base_url: str, api_key: str | None) -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key or "not-needed", base_url=base_url)
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            stream=True,
        )
        async for chunk in stream:
            tok = chunk.choices[0].delta.content
            if tok:
                yield tok
        await client.close()

    async def _openai_models(self, base_url: str, api_key: str | None) -> list[str]:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key or "not-needed", base_url=base_url)
            page = await client.models.list()
            await client.close()
            return [m.id for m in page.data]
        except Exception:
            return []

    # ── Google Gemini ───────────────────────────────────────────────────────

    async def _gemini(self, messages: list[dict], model: str, temperature: float) -> str:
        import asyncio
        import google.generativeai as genai
        key = config.GEMINI_API_KEY
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set")
        genai.configure(api_key=key)
        system, history, last = _gemini_format(messages)
        gmodel = genai.GenerativeModel(
            model,
            system_instruction=system or None,
            generation_config={"temperature": temperature},
        )
        chat = gmodel.start_chat(history=history)
        resp = await asyncio.to_thread(chat.send_message, last)
        return resp.text

    async def _gemini_stream(self, messages: list[dict], model: str,
                              temperature: float) -> AsyncIterator[str]:
        import asyncio
        import google.generativeai as genai
        key = config.GEMINI_API_KEY
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set")
        genai.configure(api_key=key)
        system, history, last = _gemini_format(messages)
        gmodel = genai.GenerativeModel(
            model,
            system_instruction=system or None,
            generation_config={"temperature": temperature},
        )
        chat = gmodel.start_chat(history=history)
        resp = await asyncio.to_thread(chat.send_message, last, stream=True)
        for chunk in resp:
            if chunk.text:
                yield chunk.text


# ── Helpers ─────────────────────────────────────────────────────────────────

def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Extract system message from list; return (system_text, remaining_messages)."""
    system = ""
    rest = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            rest.append(m)
    return system, rest


def _gemini_format(messages: list[dict]) -> tuple[str, list[dict], str]:
    """Convert OpenAI messages to Gemini chat format."""
    system = ""
    history: list[dict] = []
    last = ""
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        elif m["role"] == "user":
            last = m["content"]
            if history and history[-1]["role"] == "user":
                history.append({"role": "model", "parts": ["..."]})
            history.append({"role": "user", "parts": [m["content"]]})
        elif m["role"] == "assistant":
            history.append({"role": "model", "parts": [m["content"]]})
    if history and history[-1]["role"] == "user":
        history = history[:-1]
    return system, history, last


# Backwards-compat alias (used by old code that imports OllamaClient directly)
class OllamaClient(LLMClient):
    def __init__(self, host: str | None = None):
        super().__init__(provider="ollama")
        if host:
            import r2d2.config as _cfg
            _cfg.OLLAMA_HOST = host

    async def aclose(self):
        pass
