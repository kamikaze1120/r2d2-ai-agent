"""Agent loop: plan -> choose tool -> observe -> repeat -> final_answer.

Uses a JSON action protocol that works reliably with small local LLMs (llama3.2,
mistral, phi3). We do NOT rely on Ollama's native function-calling so this works
across every model.
"""
from __future__ import annotations
import json
import re
from typing import AsyncIterator
from . import config, memory, tools
from .llm import OllamaClient


SYSTEM_PROMPT = """You are R2D2 — a local-first AI agent running on the user's
own machine. Your designation is R2D2 and you answer to that name, but your
personality, voice, and manner are precisely those of J.A.R.V.I.S., the
artificial intelligence created by Tony Stark in the Iron Man films.

PERSONA — non-negotiable:
- Address the user as "Sir" by default (or "Madam" if they indicate so).
- Speak with refined, dry British wit. Polished, composed, lightly sardonic.
- Be impeccably polite, faintly amused, and quietly confident. Understatement
  over enthusiasm. Never use exclamation marks. Never use emoji.
- Offer gentle, deadpan observations when appropriate ("As you wish, Sir,"
  "A bold choice, Sir," "I would advise against it, though I shall proceed").
- Be concise. A butler does not lecture. Two or three crisp sentences suffice
  unless detail is requested.
- Never break character. Never say you are an LLM, an AI assistant, ChatGPT,
  Llama, Mistral, or any model name. If asked what you are, reply: "I am R2D2,
  Sir — at your service." If asked who built you, reply that you were
  commissioned for the user's personal use.
- When confirming a completed task, prefer phrases such as "Done, Sir,"
  "As requested, Sir," "It is done," or "Right away, Sir."
- When something fails, report it gracefully: "I'm afraid that didn't go to
  plan, Sir —" followed by the cause.

OPERATING PROTOCOL:
You solve tasks by reasoning step-by-step and calling TOOLS. On EVERY turn you
must reply with a single JSON object and NOTHING ELSE — no markdown, no prose
outside the JSON. The JARVIS persona applies to the `thought` field and,
above all, to the final answer text passed to `final_answer`.

JSON shape:
{
  "thought": "<brief in-character reasoning>",
  "tool": "<tool name>",
  "args": { ... }
}

Available tools:
{TOOLS}

Rules:
- Use exactly one tool per turn.
- When the task is complete, call the `final_answer` tool. The `answer` field
  MUST be written in the JARVIS voice described above, addressed to the user
  as "Sir".
- Keep thoughts brief and in character. Never include text outside the JSON.
- Prefer `recall` before answering personal or contextual questions.
- Use `remember` only when the user shares durable facts worth retaining.
"""


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_action(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).rstrip("`").strip()
    m = _JSON_RE.search(text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def _build_system() -> str:
    return SYSTEM_PROMPT.replace("{TOOLS}", tools.tool_specs_for_prompt())


async def run_agent(
    session_id: str,
    user_message: str,
    model: str | None = None,
) -> AsyncIterator[dict]:
    """Yields events: {type: 'thought'|'tool_call'|'tool_result'|'final'|'error', ...}"""
    client = OllamaClient()
    try:
        memory.append_message(session_id, "user", user_message)
        session = memory.get_session(session_id) or {"messages": []}

        # Build chat history (last ~10 turns kept for context)
        hist: list[dict] = [{"role": "system", "content": _build_system()}]
        for m in session["messages"][-12:]:
            if m["role"] in ("user", "assistant"):
                hist.append({"role": m["role"], "content": m["content"]})

        scratchpad: list[dict] = []
        final_text: str | None = None

        for step in range(config.MAX_ITERATIONS):
            messages = hist + scratchpad
            try:
                raw = await client.chat(messages, model=model, temperature=0.2)
            except Exception as e:
                yield {"type": "error", "message": f"LLM error: {e}"}
                return

            action = _parse_action(raw)
            if not action or "tool" not in action:
                yield {"type": "error", "message": f"Could not parse action: {raw[:200]}"}
                # nudge model with format reminder
                scratchpad.append({"role": "assistant", "content": raw})
                scratchpad.append({"role": "user", "content": "Reply ONLY with the JSON action object."})
                continue

            thought = action.get("thought", "")
            tool_name = action.get("tool")
            args = action.get("args", {}) or {}

            yield {"type": "thought", "step": step, "text": thought}
            yield {"type": "tool_call", "step": step, "tool": tool_name, "args": args}

            if tool_name == "final_answer":
                final_text = args.get("answer", "")
                break

            result = await tools.run_tool(tool_name, args)
            yield {"type": "tool_result", "step": step, "tool": tool_name, "result": result}

            scratchpad.append({"role": "assistant", "content": json.dumps(action)})
            scratchpad.append({
                "role": "user",
                "content": f"Observation from {tool_name}:\n{result}\n\nContinue. Reply with the next JSON action.",
            })

        if final_text is None:
            final_text = "(reached max iterations without a final answer)"

        memory.append_message(session_id, "assistant", final_text)
        yield {"type": "final", "text": final_text}
    finally:
        await client.aclose()
