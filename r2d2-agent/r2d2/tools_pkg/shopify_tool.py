"""Shopify Admin API client.

Docs: https://shopify.dev/docs/api/admin-rest
Uses Admin API access token (private app). Set SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN.
"""
from __future__ import annotations
import httpx
from .. import config


def _base() -> str:
    return f"https://{config.SHOPIFY_STORE}/admin/api/2024-10"


def _headers() -> dict:
    return {
        "X-Shopify-Access-Token": config.SHOPIFY_ADMIN_TOKEN or "",
        "Content-Type": "application/json",
    }


def configured() -> bool:
    return bool(config.SHOPIFY_STORE and config.SHOPIFY_ADMIN_TOKEN)


async def ping() -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{_base()}/shop.json", headers=_headers())
    return {"ok": r.status_code == 200, "status": r.status_code,
            "body": r.text[:300]}


async def create_product(*, title: str, body_html: str, price: float,
                         tags: list[str], product_type: str = "Digital Download",
                         status: str = "draft") -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured", "draft_only": True,
                "preview": {"title": title, "price": price}}
    payload = {
        "product": {
            "title": title, "body_html": body_html,
            "vendor": "R2D2", "product_type": product_type,
            "tags": ", ".join(tags), "status": status,
            "variants": [{"price": str(price), "requires_shipping": False,
                          "taxable": False, "inventory_management": None}],
        }
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{_base()}/products.json", headers=_headers(),
                         json=payload)
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "product": r.json()["product"]}


async def publish_product(product_id: int) -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    payload = {"product": {"id": product_id, "status": "active"}}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(f"{_base()}/products/{product_id}.json",
                        headers=_headers(), json=payload)
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "product": r.json()["product"]}


async def shop_stats() -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{_base()}/shop.json", headers=_headers())
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:300]}
    return {"ok": True, "shop": r.json().get("shop", {})}
