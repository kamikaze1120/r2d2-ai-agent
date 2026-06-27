"""Etsy Open API v3 client.

Docs: https://developers.etsy.com/documentation/reference
Auth: OAuth 2.0 PKCE. Supports access-token + refresh-token flow.

Every method returns {"ok": bool, ...}. Never raises.
Honors config.DRY_RUN — when set, no network writes happen and a preview is returned.
"""
from __future__ import annotations
import time
import httpx
from .. import config
from ..core import audit_log


BASE = "https://openapi.etsy.com/v3/application"
TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"

# In-memory cache for refreshed token (process lifetime)
_token_cache: dict[str, float | str | None] = {
    "access_token": None,
    "expires_at": 0,
}


def _headers() -> dict:
    token = (_token_cache.get("access_token")
             or config.ETSY_OAUTH_TOKEN or "")
    return {
        "x-api-key": config.ETSY_API_KEY or "",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def configured() -> bool:
    return bool(config.ETSY_API_KEY and config.ETSY_OAUTH_TOKEN
                and config.ETSY_SHOP_ID)


async def refresh_access_token() -> dict:
    """OAuth refresh-token rotation. Etsy issues short-lived access tokens (~1h)."""
    if not (config.ETSY_API_KEY and config.ETSY_REFRESH_TOKEN):
        return {"ok": False, "error": "ETSY_REFRESH_TOKEN not set"}
    payload = {
        "grant_type": "refresh_token",
        "client_id": config.ETSY_API_KEY,
        "refresh_token": config.ETSY_REFRESH_TOKEN,
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(TOKEN_URL, data=payload)
    if r.status_code >= 300:
        audit_log.log("etsy", "etsy.refresh", outcome="error",
                      detail={"status": r.status_code, "body": r.text[:300]})
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    data = r.json()
    _token_cache["access_token"] = data.get("access_token")
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 3600)) - 60
    audit_log.log("etsy", "etsy.refresh", outcome="ok",
                  detail={"expires_in": data.get("expires_in")})
    return {"ok": True, "expires_in": data.get("expires_in")}


async def _ensure_token() -> None:
    """Refresh access token if we have a refresh token and the cached one is stale."""
    if not config.ETSY_REFRESH_TOKEN:
        return
    if (not _token_cache["access_token"]
            or float(_token_cache["expires_at"] or 0) < time.time()):
        await refresh_access_token()


def _dry_run_preview(action: str, **kwargs) -> dict:
    audit_log.log("etsy", action, outcome="dry_run", detail=kwargs)
    return {"ok": True, "dry_run": True, "preview": kwargs}


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
    taxonomy_id: int = 68887190, type: str = "download",
    materials: list[str] | None = None,
) -> dict:
    if config.DRY_RUN:
        return _dry_run_preview("etsy.create_draft", title=title, price=price,
                                tags=tags[:13])
    if not configured():
        return {"ok": False, "error": "Etsy not configured (env vars missing)",
                "draft_only": True,
                "preview": {"title": title, "price": price, "tags": tags[:13]}}
    await _ensure_token()
    payload = {
        "quantity": quantity, "title": title, "description": description,
        "price": price, "who_made": who_made, "when_made": when_made,
        "taxonomy_id": taxonomy_id, "type": type, "state": "draft",
        "tags": tags[:13],
    }
    if materials:
        payload["materials"] = materials[:13]
    url = f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, headers=_headers(), json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("etsy", "etsy.create_draft", outcome=outcome,
                  detail={"status": r.status_code, "title": title})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "listing": r.json()}


async def upload_listing_image(listing_id: int, image_path: str,
                               rank: int = 1) -> dict:
    """Upload a preview image for the listing (separate from the digital file)."""
    if config.DRY_RUN:
        return _dry_run_preview("etsy.upload_image", listing_id=listing_id,
                                image_path=image_path, rank=rank)
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    await _ensure_token()
    url = (f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings/{listing_id}/images")
    _tok = _token_cache.get("access_token") or config.ETSY_OAUTH_TOKEN or ""
    headers = {
        "x-api-key": config.ETSY_API_KEY or "",
        "Authorization": f"Bearer {_tok}",
    }
    with open(image_path, "rb") as f:
        files = {"image": (image_path.split("/")[-1], f.read())}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, headers=headers, files=files,
                         data={"rank": str(rank)})
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("etsy", "etsy.upload_image", target=str(listing_id),
                  outcome=outcome, detail={"status": r.status_code})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "image": r.json()}


async def upload_listing_file(listing_id: int, file_path: str,
                              name: str | None = None) -> dict:
    if config.DRY_RUN:
        return _dry_run_preview("etsy.upload_file", listing_id=listing_id,
                                file_path=file_path)
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    await _ensure_token()
    url = (f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings/{listing_id}/files")
    _tok = _token_cache.get("access_token") or config.ETSY_OAUTH_TOKEN or ""
    headers = {
        "x-api-key": config.ETSY_API_KEY or "",
        "Authorization": f"Bearer {_tok}",
    }
    with open(file_path, "rb") as f:
        files = {"file": (name or file_path.split("/")[-1], f.read())}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(url, headers=headers, files=files)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("etsy", "etsy.upload_file", target=str(listing_id),
                  outcome=outcome, detail={"status": r.status_code})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "file": r.json()}


async def add_listing_variations(listing_id: int,
                                  variations: list[dict]) -> dict:
    """variations = [{"property":"size","value":"8x10","price":7.99}, ...]
    Implemented as Etsy "inventory" PUT — supports up to 2 properties.
    """
    if config.DRY_RUN:
        return _dry_run_preview("etsy.variations", listing_id=listing_id,
                                count=len(variations))
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    await _ensure_token()
    products = []
    for v in variations[:70]:
        products.append({
            "sku": v.get("sku", ""),
            "property_values": [{
                "property_id": 200,  # Etsy "Size" property id (placeholder)
                "value_ids": [],
                "values": [v.get("value", "")],
                "scale_id": None,
            }],
            "offerings": [{
                "price": float(v.get("price", 0)),
                "quantity": int(v.get("quantity", 999)),
                "is_enabled": True,
            }],
        })
    url = f"{BASE}/listings/{listing_id}/inventory"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(url, headers=_headers(),
                        json={"products": products,
                              "price_on_property": [],
                              "quantity_on_property": [],
                              "sku_on_property": []})
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("etsy", "etsy.variations", target=str(listing_id),
                  outcome=outcome, detail={"status": r.status_code,
                                            "count": len(variations)})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "inventory": r.json()}


async def publish_listing(listing_id: int) -> dict:
    if config.DRY_RUN:
        return _dry_run_preview("etsy.publish", listing_id=listing_id)
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    await _ensure_token()
    url = (f"{BASE}/shops/{config.ETSY_SHOP_ID}/listings/{listing_id}")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(url, headers=_headers(), json={"state": "active"})
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("etsy", "etsy.publish", target=str(listing_id),
                  outcome=outcome, detail={"status": r.status_code})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "listing": r.json()}


async def list_shop_stats() -> dict:
    if not configured():
        return {"ok": False, "error": "Etsy not configured"}
    await _ensure_token()
    url = f"{BASE}/shops/{config.ETSY_SHOP_ID}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers=_headers())
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:300]}
    return {"ok": True, "shop": r.json()}


async def search_trending_keywords(query: str, limit: int = 10) -> dict:
    """Lightweight trend signal: search Etsy listings by keyword and inspect
    the result distribution. Real eRank/EtsyHunt data requires a paid API.
    """
    if not config.ETSY_API_KEY:
        return {"ok": False, "error": "ETSY_API_KEY not set", "items": []}
    url = f"{BASE}/listings/active"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers={"x-api-key": config.ETSY_API_KEY},
                        params={"keywords": query, "limit": limit,
                                "sort_on": "score"})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:300],
                "items": []}
    data = r.json()
    return {"ok": True, "count": data.get("count", 0),
            "items": data.get("results", [])[:limit]}
