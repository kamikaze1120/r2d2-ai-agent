"""Shopify Admin API client.

Docs: https://shopify.dev/docs/api/admin-rest
Honors config.DRY_RUN — writes become previews. Logs every action to audit_log.
"""
from __future__ import annotations
import httpx
from .. import config
from ..core import audit_log


def _base() -> str:
    return f"https://{config.SHOPIFY_STORE}/admin/api/2024-10"


def _headers() -> dict:
    return {
        "X-Shopify-Access-Token": config.SHOPIFY_ADMIN_TOKEN or "",
        "Content-Type": "application/json",
    }


def configured() -> bool:
    return bool(config.SHOPIFY_STORE and config.SHOPIFY_ADMIN_TOKEN)


def _dry(action: str, **kwargs) -> dict:
    audit_log.log("shopify", action, outcome="dry_run", detail=kwargs)
    return {"ok": True, "dry_run": True, "preview": kwargs}


async def ping() -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{_base()}/shop.json", headers=_headers())
    return {"ok": r.status_code == 200, "status": r.status_code,
            "body": r.text[:300]}


async def create_product(*, title: str, body_html: str, price: float,
                         tags: list[str], product_type: str = "Digital Download",
                         status: str = "draft",
                         metafields: list[dict] | None = None) -> dict:
    if config.DRY_RUN:
        return _dry("shopify.create_product", title=title, price=price)
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
    if metafields:
        payload["product"]["metafields"] = metafields
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{_base()}/products.json", headers=_headers(),
                         json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("shopify", "shopify.create_product", outcome=outcome,
                  detail={"status": r.status_code, "title": title})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "product": r.json()["product"]}


async def add_metafield(product_id: int, namespace: str, key: str,
                         value: str, value_type: str = "single_line_text_field") -> dict:
    if config.DRY_RUN:
        return _dry("shopify.metafield", product_id=product_id, key=key)
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    payload = {"metafield": {"namespace": namespace, "key": key, "value": value,
                              "type": value_type}}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{_base()}/products/{product_id}/metafields.json",
                         headers=_headers(), json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("shopify", "shopify.metafield", target=str(product_id),
                  outcome=outcome, detail={"key": key,
                                            "status": r.status_code})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "metafield": r.json().get("metafield")}


async def add_to_collection(product_id: int, collection_id: int) -> dict:
    """Attach product to a custom collection (collect)."""
    if config.DRY_RUN:
        return _dry("shopify.collect", product_id=product_id,
                    collection_id=collection_id)
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    payload = {"collect": {"product_id": product_id,
                            "collection_id": collection_id}}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{_base()}/collects.json", headers=_headers(),
                         json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("shopify", "shopify.collect", target=str(product_id),
                  outcome=outcome, detail={"collection_id": collection_id,
                                            "status": r.status_code})
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "error": r.text[:500]}
    return {"ok": True, "collect": r.json().get("collect")}


async def list_collections() -> dict:
    if not configured():
        return {"ok": False, "error": "Shopify not configured", "collections": []}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{_base()}/custom_collections.json", headers=_headers())
    if r.status_code >= 300:
        return {"ok": False, "status": r.status_code, "collections": []}
    return {"ok": True,
            "collections": r.json().get("custom_collections", [])}


async def publish_product(product_id: int) -> dict:
    if config.DRY_RUN:
        return _dry("shopify.publish", product_id=product_id)
    if not configured():
        return {"ok": False, "error": "Shopify not configured"}
    payload = {"product": {"id": product_id, "status": "active"}}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.put(f"{_base()}/products/{product_id}.json",
                        headers=_headers(), json=payload)
    outcome = "ok" if r.status_code < 300 else "error"
    audit_log.log("shopify", "shopify.publish", target=str(product_id),
                  outcome=outcome, detail={"status": r.status_code})
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
