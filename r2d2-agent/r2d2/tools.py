"""Pluggable tool framework.

Each tool is a dict {name, description, parameters (JSON schema), run(args)->str}.
Tools are resolved by name; the agent loop chooses one per iteration.
"""
from __future__ import annotations
import asyncio
import subprocess
from pathlib import Path
from typing import Awaitable, Callable, Any
from . import config, memory


Tool = dict[str, Any]
_REGISTRY: dict[str, Tool] = {}


def register(tool: Tool) -> None:
    _REGISTRY[tool["name"]] = tool


def all_tools() -> list[Tool]:
    return list(_REGISTRY.values())


def tool_specs_for_prompt() -> str:
    lines = []
    for t in _REGISTRY.values():
        params = ", ".join(t["parameters"].get("properties", {}).keys()) or "(none)"
        lines.append(f"- {t['name']}({params}): {t['description']}")
    return "\n".join(lines)


async def run_tool(name: str, args: dict) -> str:
    tool = _REGISTRY.get(name)
    if not tool:
        return f"ERROR: unknown tool '{name}'"
    try:
        result = tool["run"](args)
        if asyncio.iscoroutine(result):
            result = await result
        return str(result)
    except Exception as e:
        return f"ERROR running {name}: {e}"


# ---------------- Sandboxed path helpers ----------------

def _safe_path(rel: str) -> Path:
    p = (config.WORKSPACE / rel).resolve()
    if config.WORKSPACE.resolve() not in p.parents and p != config.WORKSPACE.resolve():
        raise ValueError(f"Path '{rel}' escapes workspace")
    return p


# ---------------- Built-in tools ----------------

def _read_file(args: dict) -> str:
    path = _safe_path(args["path"])
    if not path.exists():
        return f"File not found: {args['path']}"
    return path.read_text(errors="replace")[:20000]


def _write_file(args: dict) -> str:
    path = _safe_path(args["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(args["content"])
    return f"Wrote {len(args['content'])} chars to {args['path']}"


def _list_dir(args: dict) -> str:
    rel = args.get("path", ".")
    path = _safe_path(rel)
    if not path.exists():
        return f"Not found: {rel}"
    entries = []
    for p in sorted(path.iterdir()):
        kind = "dir" if p.is_dir() else "file"
        entries.append(f"{kind}\t{p.name}")
    return "\n".join(entries) or "(empty)"


def _shell(args: dict) -> str:
    cmd = args["command"]
    if config.SHELL_ALLOWLIST:
        allowed = [x.strip() for x in config.SHELL_ALLOWLIST.split(",") if x.strip()]
        first = cmd.split()[0] if cmd.split() else ""
        if first not in allowed:
            return f"BLOCKED: '{first}' not in shell allowlist"
    try:
        out = subprocess.run(
            cmd,
            shell=True,
            cwd=str(config.WORKSPACE),
            capture_output=True,
            text=True,
            timeout=30,
        )
        return f"exit={out.returncode}\n--- stdout ---\n{out.stdout[:8000]}\n--- stderr ---\n{out.stderr[:4000]}"
    except subprocess.TimeoutExpired:
        return "ERROR: command timed out (30s)"


def _web_search(args: dict) -> str:
    query = args["query"]
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for i, r in enumerate(ddgs.text(query, max_results=5)):
                results.append(f"{i+1}. {r.get('title')}\n   {r.get('href')}\n   {r.get('body','')[:200]}")
        return "\n\n".join(results) or "No results"
    except Exception as e:
        return f"Web search failed: {e}"


def _remember(args: dict) -> str:
    item = memory.add_memory(args["text"], args.get("tags", []))
    return f"Stored memory id={item['id']}"


def _recall(args: dict) -> str:
    hits = memory.search_memories(args["query"], limit=5)
    if not hits:
        return "(no matching memories)"
    return "\n".join(f"- {h['text']}" for h in hits)


def _final_answer(args: dict) -> str:
    # Sentinel — handled by executor loop
    return args.get("answer", "")


def register_builtins() -> None:
    register({
        "name": "read_file",
        "description": "Read a text file from the workspace.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string", "description": "Relative path inside workspace"},
        }, "required": ["path"]},
        "run": _read_file,
    })
    register({
        "name": "write_file",
        "description": "Write/overwrite a text file in the workspace.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        }, "required": ["path", "content"]},
        "run": _write_file,
    })
    register({
        "name": "list_dir",
        "description": "List entries of a workspace directory.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
        }},
        "run": _list_dir,
    })
    register({
        "name": "shell",
        "description": "Run a shell command in the workspace (30s timeout).",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"},
        }, "required": ["command"]},
        "run": _shell,
    })
    register({
        "name": "web_search",
        "description": "Search the web using DuckDuckGo (free, no key).",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
        }, "required": ["query"]},
        "run": _web_search,
    })
    register({
        "name": "remember",
        "description": "Save a fact or note to long-term memory.",
        "parameters": {"type": "object", "properties": {
            "text": {"type": "string"},
            "tags": {"type": "array", "items": {"type": "string"}},
        }, "required": ["text"]},
        "run": _remember,
    })
    register({
        "name": "recall",
        "description": "Search long-term memory by keyword.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
        }, "required": ["query"]},
        "run": _recall,
    })
    register({
        "name": "final_answer",
        "description": "Return your final answer to the user. Use when the task is complete.",
        "parameters": {"type": "object", "properties": {
            "answer": {"type": "string"},
        }, "required": ["answer"]},
        "run": _final_answer,
    })


register_builtins()
