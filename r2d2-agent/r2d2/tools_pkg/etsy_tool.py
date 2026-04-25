"""Etsy Open API v3 client.

Docs: https://developers.etsy.com/documentation/reference
Auth: OAuth 2.0 PKCE. We accept a pre-issued OAuth token via env var
(ETSY_OAUTH_TOKEN) — interactive OAuth flow is out of scope for the agent core
and lives in the user's setup script.

Every method returns {"ok": bool, ...}. Never raises.
"""
from __future__ import annotations
import httpx
from .. import config


BASE = "https://openapi.etsy.com/v3/application"


def _headers() -> dict:
    return {
        "x-api-key": config.ETSY_API_KEY or "",
        "Authorization": f"Bearer {config.ETSY_OAUTH_TOKEN or ''}",
        "Content-Type": "application/json",
    }


def configured() -> bool:
    return bool(config.ETSY_API_KEY and config.ETSY_OAUTH_TOKEN
                and config.ETSY_SHOP_ID)


async def ping() -> dict:
    if not config.ETSY_API_KEY:
        return {"ok": False, "error": "ETSY_API_KEY not set"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{BASE}/openapi-ping",
                        headers={"x-api-key": config.ETSY_API_KEY})
    return {"ok": r.status_code == 200, "status": r.status_code,
            "body": r.text[:300]}


async def create_draft_listing(
    *, title: str, description: str, price: float, tags: list[str],
    quantity: int = 999, who_made: str = "i_did", when_made: str = "made_to_order",
    taxonomy_id: int = 68887190,  # Digital Prints
    type: str = "download",
) -> dict:
    if not configured():
        return {"ok": False, "error": "Etsy not configured (env vars missing)",
                "draft_only": True,
                "preview": {"title": title, "price": price, "tags": tags[:13]}}
    payload = {
        "quantity": quantity, "title": title, "description": description,
        "price": price, "who_made": who_made, "when_made": when_made,
        "taxonomy_id": taxonomy_id, "type": type, "state": "draft",
        "tags": tags[:13],
    }
    url = f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, headers=_headers(), json=payload)
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "listing": r.json()}


async def upload_listing_file(listing_id: int, file_path: str,
                              name: str | None = None) -> dict:
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    url = (f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings/{listing_id}"
           "/files")
    headers = {
        "x-api-key": config.ETSY_API_KEY or "",
        "Authorization": f"Bearer {config.ETSY_OAUTH_TOKEN or ''}",
    }
    with open(file_path, "rb") as f:
        files = {"file": (name or file_path.split("/")[-1], f.read())}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, headers=headers, files=files)
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "file": r.json()}


async def publish_listing(listing_id: int) -> dict:
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    url = (f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings/{listing_id}")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(url, headers=_headers(), json={"state": "active"})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "listing": r.json()}


async def list_shop_stats() -> dict:
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    url = f"{BASE}/shops/{config.ETSY_SHOP_ID}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers=_headers())
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:300]}
    return {"ok": True, "shop": r.json()}
