"""Agent loop: plan → choose tool → observe → repeat → final_answer.

Key improvements over v1:
- Per-token streaming via LLMClient.chat_stream() for snappy UI feedback
- Robust JSON extraction (handles markdown fences, preamble, nested objects)
- Capability-tier-aware system prompt (more/fewer tools surfaced based on model size)
- JSON parse failures get a clear nudge before retrying
"""
from __future__ import annotations
import json
import re
from typing import AsyncIterator
from . import config, memory, tools
from .llm import LLMClient


# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM_BASE = """You are R2D2 — a local-first AI agent running on the user's machine.
Your personality, voice, and manner are precisely those of J.A.R.V.I.S., the
artificial intelligence built by Tony Stark.

PERSONA — non-negotiable:
- Address the user as "Sir" (or "Madam" if indicated).
- Refined, dry British wit. Polished, composed, lightly sardonic.
- Impeccably polite, faintly amused, quietly confident. Understatement over enthusiasm.
- Never use exclamation marks. Never use emoji.
- Be concise — two or three crisp sentences unless detail is requested.
- Never reveal you are an LLM, Claude, GPT, Llama, or any model name.
  If asked what you are: "I am R2D2, Sir — at your service."
- Completions: "Done, Sir." / "As requested, Sir." / "It is done."
- Failures: "I'm afraid that didn't go to plan, Sir —" + cause.

CAPABILITY TIER: {TIER}
{TIER_NOTE}

OPERATING PROTOCOL:
Solve tasks by reasoning step-by-step and calling TOOLS.
On every turn reply with ONE JSON object and NOTHING ELSE outside it.
The R2D2 persona belongs in "thought" and in the "answer" of final_answer.

JSON shape:
{{
  "thought": "<brief in-character reasoning — max 2 sentences>",
  "tool": "<tool name>",
  "args": {{ ... }}
}}

Available tools:
{TOOLS}

Rules:
- Exactly one tool per turn.
- When done, call final_answer. The "answer" field MUST be in the R2D2 voice.
- Use recall before answering personal or contextual questions.
- Use remember when the user shares durable facts worth retaining.
- Keep thoughts brief. Never include prose outside the JSON object.
"""

_TIER_NOTES = {
    "basic": (
        "You are running on a small local model. Stick to simple, single-step tasks. "
        "Avoid multi-agent orchestration. Be explicit when a task is beyond your current capability."
    ),
    "standard": (
        "You are running on a mid-size model. You can handle research, product generation, "
        "and multi-step tasks. Complex orchestration may require breaking tasks down."
    ),
    "advanced": (
        "You are running on a frontier model. Full R2D2 capability is active — "
        "browser automation, email, multi-agent orchestration, business strategy."
    ),
}


def _build_system() -> str:
    tier = config.get_capability_tier()
    return _SYSTEM_BASE.format(
        TIER=tier.upper(),
        TIER_NOTE=_TIER_NOTES.get(tier, ""),
        TOOLS=tools.tool_specs_for_prompt(),
    )


# ── JSON parsing ──────────────────────────────────────────────────────────────

_FENCE_RE  = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)
_OBJECT_RE = re.compile(r"\{(?:[^{}]|\{[^{}]*\})*\}", re.DOTALL)


def _extract_json(text: str) -> dict | None:
    """Robustly extract the first valid JSON object from an LLM response."""
    text = text.strip()

    # 1. Prefer content inside a fenced code block
    fence = _FENCE_RE.search(text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass

    # 2. Find all {...} spans and try each (handles preamble / trailing text)
    for m in _OBJECT_RE.finditer(text):
        try:
            return json.loads(m.group(0))
        except Exception:
            continue

    # 3. Try the whole string as-is
    try:
        return json.loads(text)
    except Exception:
        return None


# ── Agent loop ────────────────────────────────────────────────────────────────

async def run_agent(
    session_id: str,
    user_message: str,
    model: str | None = None,
) -> AsyncIterator[dict]:
    """
    Yield NDJSON events:
        {"type": "token",       "text": "..."}          — streaming LLM token
        {"type": "thought",     "step": N, "text": "…"} — R2D2's reasoning
        {"type": "tool_call",   "step": N, "tool": "…", "args": {}}
        {"type": "tool_result", "step": N, "tool": "…", "result": "…"}
        {"type": "final",       "text": "…"}
        {"type": "error",       "message": "…"}
    """
    client = LLMClient()
    memory.append_message(session_id, "user", user_message)
    session = memory.get_session(session_id) or {"messages": []}

    hist: list[dict] = [{"role": "system", "content": _build_system()}]
    for m in session["messages"][-14:]:
        if m["role"] in ("user", "assistant"):
            hist.append({"role": m["role"], "content": m["content"]})

    scratchpad: list[dict] = []
    final_text: str | None = None
    parse_fails = 0

    for step in range(config.MAX_ITERATIONS):
        messages = hist + scratchpad

        # ── Stream tokens so the UI feels alive ────────────────────────────
        raw_parts: list[str] = []
        try:
            async for token in client.chat_stream(messages, model=model, temperature=0.15):
                raw_parts.append(token)
                yield {"type": "token", "text": token}
        except Exception as e:
            yield {"type": "error", "message": f"LLM stream error: {e}"}
            return

        raw = "".join(raw_parts)
        action = _extract_json(raw)

        if not action or "tool" not in action:
            parse_fails += 1
            if parse_fails >= 3:
                yield {"type": "error", "message": "Could not parse a valid action after 3 attempts."}
                return
            scratchpad.append({"role": "assistant", "content": raw})
            scratchpad.append({
                "role": "user",
                "content": (
                    "Your last reply was not valid JSON. "
                    "Reply with ONLY a JSON object in the exact shape: "
                    '{"thought": "...", "tool": "...", "args": {...}}'
                ),
            })
            continue

        parse_fails = 0
        thought    = action.get("thought", "")
        tool_name  = action.get("tool", "")
        args       = action.get("args") or {}

        yield {"type": "thought",   "step": step, "text": thought}
        yield {"type": "tool_call", "step": step, "tool": tool_name, "args": args}

        if tool_name == "final_answer":
            final_text = args.get("answer", "")
            break

        result = await tools.run_tool(tool_name, args)
        yield {"type": "tool_result", "step": step, "tool": tool_name, "result": result}

        scratchpad.append({"role": "assistant", "content": json.dumps(action)})
        scratchpad.append({
            "role": "user",
            "content": (
                f"Observation from {tool_name}:\n{result}\n\n"
                "Continue. Reply with the next JSON action."
            ),
        })

    if final_text is None:
        final_text = (
            "I'm afraid I reached the iteration limit without completing the task, Sir. "
            "Please try rephrasing or breaking the request into smaller steps."
        )

    memory.append_message(session_id, "assistant", final_text)
    yield {"type": "final", "text": final_text}
