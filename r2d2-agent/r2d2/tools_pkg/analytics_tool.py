"""Sync platform analytics back into the local performance tracker.

Pulls listing views/sales from Etsy + Shopify and records events.
Called by the scheduler daily.
"""
from __future__ import annotations
import httpx
from . import etsy_tool, shopify_tool
from .. import config
from ..analytics import performance_tracker


async def sync_etsy_metrics(product_records: list[dict]) -> dict:
    """product_records: items from business_memory with platform_ids.etsy set."""
    if not etsy_tool.configured():
        return {"ok": False, "error": "Etsy not configured", "synced": 0}
    synced = 0
    async with httpx.AsyncClient(timeout=15) as c:
        for p in product_records:
            lid = p.get("platform_ids", {}).get("etsy")
            if not lid:
                continue
            url = (f"https://openapi.etsy.com/v3/application/shops/"
                   f"{config.ETSY_SHOP_ID}/listings/{lid}/stats")
            r = await c.get(url, headers={
                "x-api-key": config.ETSY_API_KEY or "",
                "Authorization": f"Bearer {config.ETSY_OAUTH_TOKEN or ''}",
            })
            if r.status_code != 200:
                continue
            data = r.json()
            performance_tracker.record(
                "view", product_id=p["id"], niche_id=p.get("niche_id"),
                platform="etsy", quantity=int(data.get("views", 0)),
            )
            synced += 1
    return {"ok": True, "synced": synced}


async def sync_shopify_metrics(product_records: list[dict]) -> dict:
    if not shopify_tool.configured():
        return {"ok": False, "error": "Shopify not configured", "synced": 0}
    # Real implementation would query Shopify Analytics API or webhooks.
    # For now we just confirm reachability.
    ping = await shopify_tool.ping()
    return {"ok": ping["ok"], "synced": 0,
            "note": "Wire Shopify Analytics API or order webhooks for sales."}
