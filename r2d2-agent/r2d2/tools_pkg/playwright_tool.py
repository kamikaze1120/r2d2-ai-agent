"""Playwright stub.

Per user choice (official APIs only), browser automation is intentionally
disabled. This module exists so future workflows (Pinterest pinning, TikTok
scheduling) have a clear seam to extend.
"""
from __future__ import annotations


async def is_available() -> dict:
    try:
        import playwright  # type: ignore  # noqa: F401
        return {"ok": True, "installed": True,
                "note": "Playwright is installed but disabled in this build."}
    except ImportError:
        return {"ok": False, "installed": False,
                "note": "Playwright not installed. Run `pip install playwright` "
                        "and `playwright install chromium` to enable."}


async def open_session(_: dict) -> dict:
    return {"ok": False,
            "error": "Browser automation is disabled. Use API-based tools."}
