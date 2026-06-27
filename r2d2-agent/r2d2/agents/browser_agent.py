"""Browser agent — AI-guided web automation.

Handles tasks like:
  - "search for X and give me the top results"
  - "go to amazon.com and find the price of Y"
  - "fill in the contact form at example.com with ..."
  - "scrape the table at <url>"
  - "take a screenshot of <url>"

TASK_TYPES accepted by the dispatcher:
  browser_task   — generic browser task described in payload["instruction"]
  web_research   — navigate + extract text for research tasks
  screenshot     — capture a URL
"""
from __future__ import annotations
from ..tools_pkg import browser_tool
from ._llm import llm_text

TASK_TYPES = ["browser_task", "web_research", "screenshot_task"]

_SYSTEM = (
    "You are R2D2's browser automation sub-agent. "
    "Given a web page's text content and a task, extract the relevant information "
    "or describe what you found. Be concise and factual. "
    "If the page doesn't contain what was requested, say so clearly."
)


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    task_type = task.get("type", "browser_task")

    instruction = payload.get("instruction") or payload.get("query") or ""
    url         = payload.get("url", "")

    if task_type == "screenshot_task":
        if not url:
            return {"ok": False, "error": "url required for screenshot_task"}
        nav = await browser_tool.navigate(url)
        if not nav.get("ok"):
            return {"ok": False, "stage": "navigate", "error": nav.get("error")}
        ss = await browser_tool.screenshot(payload.get("filename", "screenshot.png"))
        return {**ss, "url": nav["url"], "title": nav.get("title", "")}

    if url:
        nav = await browser_tool.navigate(url)
        if not nav.get("ok"):
            return {"ok": False, "stage": "navigate", "error": nav.get("error")}
        page_data = await browser_tool.get_text(max_chars=8000)
    elif instruction:
        # Extract URL from instruction if present, otherwise do a web search
        import re
        url_match = re.search(r'https?://\S+', instruction)
        if url_match:
            nav = await browser_tool.navigate(url_match.group(0))
            if not nav.get("ok"):
                return {"ok": False, "stage": "navigate", "error": nav.get("error")}
            page_data = await browser_tool.get_text(max_chars=8000)
        else:
            page_data = await browser_tool.search_web(instruction)
    else:
        return {"ok": False, "error": "Provide url or instruction"}

    if not page_data.get("ok"):
        return {"ok": False, "stage": "read", "error": page_data.get("error")}

    # Use LLM to extract/summarise relevant info from the page
    if instruction:
        prompt = (
            f"Task: {instruction}\n\n"
            f"Page URL: {page_data.get('url', url)}\n"
            f"Page title: {page_data.get('title', '')}\n\n"
            f"Page content:\n{page_data.get('text', '')}\n\n"
            "Based on the page content above, complete the task. "
            "Be specific and cite information you found on the page."
        )
        answer = await llm_text(prompt, system=_SYSTEM)
    else:
        answer = page_data.get("text", "")[:3000]

    return {
        "ok": True,
        "url": page_data.get("url", url),
        "title": page_data.get("title", ""),
        "result": answer,
    }
