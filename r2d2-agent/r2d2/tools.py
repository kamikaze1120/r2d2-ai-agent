"""Pluggable tool framework.

Each tool is a dict: {name, description, parameters (JSON schema), run(args)->str}.
Tools are resolved by name; the agent loop picks one per iteration.

Built-in tools registered here:
  read_file, write_file, list_dir, shell, web_search,
  remember, recall, datetime, calculate
"""
from __future__ import annotations
import asyncio
import datetime
import subprocess
from pathlib import Path
from typing import Any
from . import config, memory


Tool = dict[str, Any]
_REGISTRY: dict[str, Tool] = {}


def register(tool: Tool) -> None:
    _REGISTRY[tool["name"]] = tool


def all_tools() -> list[Tool]:
    return list(_REGISTRY.values())


def tool_names() -> list[str]:
    return list(_REGISTRY.keys())


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


# ── Sandboxed path helpers ───────────────────────────────────────────────────

def _safe_path(rel: str) -> Path:
    p = (config.WORKSPACE / rel).resolve()
    if config.WORKSPACE.resolve() not in p.parents and p != config.WORKSPACE.resolve():
        raise ValueError(f"Path '{rel}' escapes workspace")
    return p


# ── Built-in tools ────────────────────────────────────────────────────────────

def _read_file(args: dict) -> str:
    path = _safe_path(args["path"])
    if not path.exists():
        return f"File not found: {args['path']}"
    return path.read_text(errors="replace")[:20_000]


def _write_file(args: dict) -> str:
    path = _safe_path(args["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(args["content"], encoding="utf-8")
    return f"Wrote {len(args['content'])} chars to {args['path']}"


def _append_file(args: dict) -> str:
    path = _safe_path(args["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(args["content"])
    return f"Appended {len(args['content'])} chars to {args['path']}"


def _list_dir(args: dict) -> str:
    rel = args.get("path", ".")
    path = _safe_path(rel)
    if not path.exists():
        return f"Not found: {rel}"
    entries = []
    for p in sorted(path.iterdir()):
        kind = "dir" if p.is_dir() else "file"
        size = f"  ({p.stat().st_size} bytes)" if p.is_file() else ""
        entries.append(f"{kind}\t{p.name}{size}")
    return "\n".join(entries) or "(empty)"


def _delete_file(args: dict) -> str:
    path = _safe_path(args["path"])
    if not path.exists():
        return f"Not found: {args['path']}"
    path.unlink()
    return f"Deleted {args['path']}"


def _shell(args: dict) -> str:
    cmd = args["command"]
    if config.SHELL_ALLOWLIST:
        allowed = [x.strip() for x in config.SHELL_ALLOWLIST.split(",") if x.strip()]
        first = cmd.split()[0] if cmd.split() else ""
        if first not in allowed:
            return f"BLOCKED: '{first}' not in SHELL_ALLOWLIST ({', '.join(allowed)})"
    try:
        out = subprocess.run(
            cmd,
            shell=True,
            cwd=str(config.WORKSPACE),
            capture_output=True,
            text=True,
            timeout=60,
        )
        return (
            f"exit={out.returncode}\n"
            f"--- stdout ---\n{out.stdout[:8000]}\n"
            f"--- stderr ---\n{out.stderr[:2000]}"
        )
    except subprocess.TimeoutExpired:
        return "ERROR: command timed out (60s)"


def _web_search(args: dict) -> str:
    query = args["query"]
    max_results = int(args.get("max_results", 5))
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for i, r in enumerate(ddgs.text(query, max_results=max_results)):
                results.append(
                    f"{i+1}. {r.get('title', '')}\n"
                    f"   URL: {r.get('href', '')}\n"
                    f"   {r.get('body', '')[:300]}"
                )
        return "\n\n".join(results) or "No results found."
    except Exception as e:
        return f"Web search error: {e}"


def _remember(args: dict) -> str:
    item = memory.add_memory(args["text"], args.get("tags", []))
    return f"Stored in long-term memory (id={item['id'][:8]})"


def _recall(args: dict) -> str:
    hits = memory.search_memories(args["query"], limit=int(args.get("limit", 5)))
    if not hits:
        return "(no matching memories)"
    return "\n".join(f"[{h['id'][:8]}] {h['text']}" for h in hits)


def _datetime_now(_args: dict) -> str:
    now = datetime.datetime.now()
    return (
        f"Date: {now.strftime('%A, %B %d, %Y')}\n"
        f"Time: {now.strftime('%I:%M %p')}\n"
        f"ISO:  {now.isoformat()}"
    )


def _calculate(args: dict) -> str:
    expr = args.get("expression", "")
    try:
        result = eval(expr, {"__builtins__": {}}, {})  # noqa: S307
        return str(result)
    except Exception as e:
        return f"Calculation error: {e}"


def _final_answer(args: dict) -> str:
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
        "description": "Write or overwrite a text file in the workspace.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        }, "required": ["path", "content"]},
        "run": _write_file,
    })
    register({
        "name": "append_file",
        "description": "Append text to an existing file (or create it).",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
        }, "required": ["path", "content"]},
        "run": _append_file,
    })
    register({
        "name": "list_dir",
        "description": "List files and directories in a workspace folder.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string", "description": "Relative path, default '.'"},
        }},
        "run": _list_dir,
    })
    register({
        "name": "delete_file",
        "description": "Delete a file from the workspace.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
        }, "required": ["path"]},
        "run": _delete_file,
    })
    register({
        "name": "shell",
        "description": "Run a shell command in the workspace sandbox (60s timeout).",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"},
        }, "required": ["command"]},
        "run": _shell,
    })
    register({
        "name": "web_search",
        "description": "Search the web with DuckDuckGo. Returns titles, URLs, and snippets.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string"},
            "max_results": {"type": "integer", "default": 5},
        }, "required": ["query"]},
        "run": _web_search,
    })
    register({
        "name": "remember",
        "description": "Save a fact, preference, or note to long-term memory.",
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
            "limit": {"type": "integer", "default": 5},
        }, "required": ["query"]},
        "run": _recall,
    })
    register({
        "name": "datetime",
        "description": "Get the current date and time.",
        "parameters": {"type": "object", "properties": {}},
        "run": _datetime_now,
    })
    register({
        "name": "calculate",
        "description": "Evaluate a mathematical expression (e.g. '2**10 + 3*7').",
        "parameters": {"type": "object", "properties": {
            "expression": {"type": "string"},
        }, "required": ["expression"]},
        "run": _calculate,
    })
    register({
        "name": "final_answer",
        "description": "Deliver your final answer to the user. Call this when the task is complete.",
        "parameters": {"type": "object", "properties": {
            "answer": {"type": "string"},
        }, "required": ["answer"]},
        "run": _final_answer,
    })


def _register_platform_tools() -> None:
    """Register browser + email tools if their deps are available."""
    # ── Browser (Playwright) ──────────────────────────────────────────────────
    try:
        from .tools_pkg import browser_tool as _bt

        def _browser_navigate(args: dict) -> Any:
            import asyncio
            return asyncio.run(_bt.navigate(args["url"], args.get("wait_until", "domcontentloaded")))

        def _browser_read(args: dict) -> Any:
            import asyncio
            result = asyncio.run(_bt.get_text(int(args.get("max_chars", 10000))))
            return result.get("text", result.get("error", "No content"))

        def _browser_click(args: dict) -> Any:
            import asyncio
            return asyncio.run(_bt.click(args.get("selector", ""), args.get("text", "")))

        def _browser_fill(args: dict) -> Any:
            import asyncio
            return asyncio.run(_bt.fill(args["selector"], args["value"], bool(args.get("submit", False))))

        def _browser_screenshot(args: dict) -> Any:
            import asyncio
            return asyncio.run(_bt.screenshot(args.get("filename", "screenshot.png")))

        def _browser_search(args: dict) -> Any:
            import asyncio
            result = asyncio.run(_bt.search_web(args["query"], args.get("engine", "duckduckgo")))
            return result.get("text", result.get("error", "No results"))

        def _browser_js(args: dict) -> Any:
            import asyncio
            return asyncio.run(_bt.run_js(args["script"]))

        register({"name": "browser_navigate", "description": "Open a URL in the browser.",
                  "parameters": {"type": "object", "properties": {
                      "url": {"type": "string"},
                      "wait_until": {"type": "string", "default": "domcontentloaded"},
                  }, "required": ["url"]}, "run": _browser_navigate})

        register({"name": "browser_read", "description": "Read the visible text of the current browser page.",
                  "parameters": {"type": "object", "properties": {
                      "max_chars": {"type": "integer", "default": 10000},
                  }}, "run": _browser_read})

        register({"name": "browser_click", "description": "Click an element on the current page.",
                  "parameters": {"type": "object", "properties": {
                      "selector": {"type": "string", "description": "CSS selector"},
                      "text": {"type": "string", "description": "Visible text to click"},
                  }}, "run": _browser_click})

        register({"name": "browser_fill", "description": "Type into a form field on the current page.",
                  "parameters": {"type": "object", "properties": {
                      "selector": {"type": "string"},
                      "value": {"type": "string"},
                      "submit": {"type": "boolean", "default": False, "description": "Press Enter after filling"},
                  }, "required": ["selector", "value"]}, "run": _browser_fill})

        register({"name": "browser_screenshot", "description": "Take a screenshot of the current page.",
                  "parameters": {"type": "object", "properties": {
                      "filename": {"type": "string", "default": "screenshot.png"},
                  }}, "run": _browser_screenshot})

        register({"name": "browser_search", "description": "Search the web using a browser (returns full page text).",
                  "parameters": {"type": "object", "properties": {
                      "query": {"type": "string"},
                      "engine": {"type": "string", "default": "duckduckgo",
                                 "description": "duckduckgo | google | bing"},
                  }, "required": ["query"]}, "run": _browser_search})

        register({"name": "browser_js", "description": "Run JavaScript in the current browser page.",
                  "parameters": {"type": "object", "properties": {
                      "script": {"type": "string"},
                  }, "required": ["script"]}, "run": _browser_js})

    except Exception:
        pass  # Playwright not installed — browser tools silently absent

    # ── Email (SMTP/IMAP) ─────────────────────────────────────────────────────
    try:
        from .tools_pkg import email_tool as _et

        def _email_send(args: dict) -> Any:
            return _et.send_email(
                to=args["to"],
                subject=args.get("subject", "(no subject)"),
                body=args.get("body", ""),
                html=bool(args.get("html", False)),
                cc=args.get("cc"),
            )

        def _email_read(args: dict) -> Any:
            return _et.read_emails(
                folder=args.get("folder", "INBOX"),
                count=int(args.get("count", 5)),
                unread_only=bool(args.get("unread_only", False)),
            )

        def _email_search(args: dict) -> Any:
            return _et.search_emails(
                query=args["query"],
                folder=args.get("folder", "INBOX"),
                count=int(args.get("count", 5)),
            )

        register({"name": "email_send",
                  "description": "Send an email via SMTP.",
                  "parameters": {"type": "object", "properties": {
                      "to": {"type": "string", "description": "Recipient email address"},
                      "subject": {"type": "string"},
                      "body": {"type": "string"},
                      "html": {"type": "boolean", "default": False},
                      "cc": {"type": "string"},
                  }, "required": ["to", "subject", "body"]}, "run": _email_send})

        register({"name": "email_read",
                  "description": "Read recent emails from a mailbox folder.",
                  "parameters": {"type": "object", "properties": {
                      "folder": {"type": "string", "default": "INBOX"},
                      "count": {"type": "integer", "default": 5},
                      "unread_only": {"type": "boolean", "default": False},
                  }}, "run": _email_read})

        register({"name": "email_search",
                  "description": "Search emails by subject or sender.",
                  "parameters": {"type": "object", "properties": {
                      "query": {"type": "string"},
                      "folder": {"type": "string", "default": "INBOX"},
                      "count": {"type": "integer", "default": 5},
                  }, "required": ["query"]}, "run": _email_search})

    except Exception:
        pass  # Email not configured — silently skip


# Register everything at import time
register_builtins()
_register_platform_tools()
