"""Upload agent: publishes a product to Etsy and/or Shopify.

Confidence-gated: high-confidence listings auto-publish, low-confidence ones
flip the task to needs_approval (handled by dispatcher).
"""
from __future__ import annotations
from ..memory import business_memory
from ..tools_pkg import etsy_tool, shopify_tool
from .. import config


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    product_id = payload.get("product_id")
    platform = payload.get("platform", "etsy")
    product = next((p for p in business_memory.list_products()
                    if p["id"] == product_id), None)
    if not product:
        return {"ok": False, "error": f"product {product_id} not found"}
    listing = product.get("metadata", {}).get("listing") or product.get("listing")
    if not listing:
        return {"ok": False, "error": "product has no listing copy yet"}

    file_path = product.get("file_path")
    confidence = float(listing.get("confidence", 0.5))

    if platform == "etsy":
        draft = await etsy_tool.create_draft_listing(
            title=listing["title"],
            description=listing["description"],
            price=listing["price_usd"],
            tags=listing["tags"],
        )
        if not draft.get("ok"):
            return {"ok": False, "stage": "draft", "error": draft.get("error"),
                    "preview": draft.get("preview"),
                    "draft_only": draft.get("draft_only")}
        listing_id = draft["listing"].get("listing_id")
        if file_path:
            await etsy_tool.upload_listing_file(listing_id, file_path)
        if confidence >= config.APPROVAL_THRESHOLD:
            await etsy_tool.publish_listing(listing_id)
            business_memory.update_product(
                product_id, status="published",
                platform_ids={**product.get("platform_ids", {}),
                              "etsy": listing_id})
            return {"ok": True, "platform": "etsy", "listing_id": listing_id,
                    "auto_published": True, "confidence": confidence}
        return {"ok": True, "platform": "etsy", "listing_id": listing_id,
                "auto_published": False, "confidence": confidence,
                "needs_approval": True}

    if platform == "shopify":
        prod = await shopify_tool.create_product(
            title=listing["title"],
            body_html=f"<p>{listing['description'].replace(chr(10), '</p><p>')}</p>",
            price=listing["price_usd"],
            tags=listing["tags"],
        )
        if not prod.get("ok"):
            return {"ok": False, "stage": "create",
                    "error": prod.get("error"), "preview": prod.get("preview"),
                    "draft_only": prod.get("draft_only")}
        pid = prod["product"]["id"]
        if confidence >= config.APPROVAL_THRESHOLD:
            await shopify_tool.publish_product(pid)
            business_memory.update_product(
                product_id, status="published",
                platform_ids={**product.get("platform_ids", {}),
                              "shopify": pid})
            return {"ok": True, "platform": "shopify", "product_id": pid,
                    "auto_published": True, "confidence": confidence}
        return {"ok": True, "platform": "shopify", "product_id": pid,
                "auto_published": False, "confidence": confidence,
                "needs_approval": True}

    return {"ok": False, "error": f"unknown platform {platform}"}
