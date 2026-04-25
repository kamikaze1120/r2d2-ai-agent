"""Pinterest API client (v5).

Docs: https://developers.pinterest.com/docs/api/v5/
Posts pins to a configured board. Honors DRY_RUN.
"""
from __future__ import annotations
import httpx
from .. import config
from ..core import audit_log


BASE = "https://api.pinterest.com/v5"


def configured() -> bool:
    return bool(config.PINTEREST_ACCESS_TOKEN and config.PINTEREST_BOARD_ID)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {config.PINTEREST_ACCESS_TOKEN or ''}",
        "Content-Type": "application/json",
    }


async def create_pin(*, title: str, description: str, link: str,
                     image_url: str, board_id: str | None = None) -> dict:
    if config.DRY_RUN:
        audit_log.log("pinterest", "pinterest.create_pin", outcome="dry_run",
                      detail={"title": title})
        return {"ok": True, "dry_run": True,
                "preview": {"title": title, "link": link}}
    if not configured():
        audit_log.log("pinterest", "pinterest.create_pin", outcome="blocked",
                      detail={"reason": "not configured"})
        return {"ok": False, "error": "Pinterest not configured",
                "preview": {"title": title}}
    payload = {
        "title": title[:100],
        "description": description[:500],
        "link": link,
        "board_id": board_id or config.PINTEREST_BOARD_ID,
        "media_source": {"source_type": "image_url", "url": image_url},
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{BASE}/pins", headers=_headers(), json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("pinterest", "pinterest.create_pin", outcome=outcome,
                  detail={"status": r.status_code, "title": title})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "pin": r.json()}
