"""Browser automation via Playwright (async).

Provides a persistent browser session per-process so R2D2 can:
  - navigate to URLs
  - read full page text / HTML
  - click elements by CSS selector or visible text
  - fill in form fields
  - take screenshots (saved to workspace)
  - extract structured data from a page
  - run arbitrary JS

Install browsers once after pip install:
    python -m playwright install chromium
"""
from __future__ import annotations
import asyncio
import base64
from pathlib import Path
from typing import Any
from .. import config

# Lazy module-level browser state
_playwright = None
_browser    = None
_page       = None
_lock       = asyncio.Lock()


async def _get_page():
    """Return (or create) a shared Playwright page."""
    global _playwright, _browser, _page
    async with _lock:
        if _page is not None:
            try:
                # Check page is still alive
                await _page.title()
                return _page
            except Exception:
                _page = None

        if _browser is None or not _browser.is_connected():
            try:
                from playwright.async_api import async_playwright
                _playwright = await async_playwright().__aenter__()
                _browser = await _playwright.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
            except Exception as e:
                raise RuntimeError(
                    f"Playwright not available: {e}. "
                    "Run: python -m playwright install chromium"
                )

        context = await _browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        _page = await context.new_page()
        return _page


async def navigate(url: str, wait_until: str = "domcontentloaded") -> dict:
    """Navigate to a URL. Returns page title + final URL."""
    try:
        page = await _get_page()
        resp = await page.goto(url, wait_until=wait_until, timeout=30_000)
        title = await page.title()
        return {
            "ok": True,
            "url": page.url,
            "title": title,
            "status": resp.status if resp else None,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def get_text(max_chars: int = 15_000) -> dict:
    """Get the visible text content of the current page."""
    try:
        page = await _get_page()
        text = await page.evaluate(
            """() => {
                const clone = document.cloneNode(true);
                for (const el of clone.querySelectorAll('script,style,nav,footer,header,aside'))
                    el.remove();
                return clone.body ? clone.body.innerText : document.body.innerText;
            }"""
        )
        return {
            "ok": True,
            "url": page.url,
            "title": await page.title(),
            "text": (text or "")[:max_chars],
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def get_links() -> dict:
    """Get all hyperlinks on the current page."""
    try:
        page = await _get_page()
        links = await page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                text: a.innerText.trim().slice(0, 80),
                href: a.href
            }))"""
        )
        return {"ok": True, "links": links}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def click(selector: str = "", text: str = "") -> dict:
    """Click an element by CSS selector or by visible text."""
    try:
        page = await _get_page()
        if text:
            await page.get_by_text(text, exact=False).first.click(timeout=10_000)
        elif selector:
            await page.click(selector, timeout=10_000)
        else:
            return {"ok": False, "error": "Provide selector or text"}
        await page.wait_for_load_state("domcontentloaded", timeout=10_000)
        return {"ok": True, "url": page.url, "title": await page.title()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def fill(selector: str, value: str, submit: bool = False) -> dict:
    """Fill a form field. Pass submit=True to press Enter after."""
    try:
        page = await _get_page()
        await page.fill(selector, value, timeout=10_000)
        if submit:
            await page.press(selector, "Enter")
            await page.wait_for_load_state("domcontentloaded", timeout=15_000)
        return {"ok": True, "field": selector}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def screenshot(filename: str = "screenshot.png") -> dict:
    """Take a screenshot and save it to the workspace. Returns the file path."""
    try:
        page = await _get_page()
        out = config.WORKSPACE / "screenshots" / filename
        out.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out), full_page=False)
        return {"ok": True, "path": str(out), "filename": filename}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def run_js(script: str) -> dict:
    """Execute arbitrary JavaScript in the current page context."""
    try:
        page = await _get_page()
        result = await page.evaluate(script)
        return {"ok": True, "result": str(result)[:4000]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def extract_table(selector: str = "table") -> dict:
    """Extract a table from the page as a list of row dicts."""
    try:
        page = await _get_page()
        data = await page.evaluate(
            f"""() => {{
                const tbl = document.querySelector({repr(selector)});
                if (!tbl) return null;
                const headers = Array.from(tbl.querySelectorAll('th')).map(h => h.innerText.trim());
                const rows = Array.from(tbl.querySelectorAll('tr')).slice(1).map(row => {{
                    const cells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
                    return headers.length ? Object.fromEntries(headers.map((h,i) => [h, cells[i]||''])) : cells;
                }});
                return rows;
            }}"""
        )
        if data is None:
            return {"ok": False, "error": f"No table found matching '{selector}'"}
        return {"ok": True, "rows": data, "count": len(data)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def search_web(query: str, engine: str = "duckduckgo") -> dict:
    """Navigate to a search engine and return the visible results page text."""
    urls = {
        "duckduckgo": f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
        "google": f"https://www.google.com/search?q={query.replace(' ', '+')}",
        "bing": f"https://www.bing.com/search?q={query.replace(' ', '+')}",
    }
    url = urls.get(engine, urls["duckduckgo"])
    nav = await navigate(url)
    if not nav.get("ok"):
        return nav
    return await get_text(max_chars=8000)


async def close() -> None:
    """Close the browser session."""
    global _browser, _page, _playwright
    try:
        if _page:
            await _page.close()
        if _browser:
            await _browser.close()
        if _playwright:
            await _playwright.__aexit__(None, None, None)
    except Exception:
        pass
    _browser = _page = _playwright = None


def configured() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except ImportError:
        return False
