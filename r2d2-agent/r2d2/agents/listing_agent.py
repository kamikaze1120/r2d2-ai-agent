"""Listing agent: SEO title, description, tags + confidence score."""
from __future__ import annotations
from . import _llm
from ..memory import business_memory


SYSTEM = (
    "You are an Etsy and Shopify SEO copywriter. You write listing copy that "
    "ranks: keyword-rich titles (≤140 chars), conversion-focused descriptions, "
    "exactly 13 long-tail tags. You never invent features the file doesn't have."
)


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    product_id = payload.get("product_id")
    product = next((p for p in business_memory.list_products()
                    if p["id"] == product_id), None)
    if not product:
        return {"ok": False, "error": f"product {product_id} not found"}

    niche = next((n for n in business_memory.list_niches()
                  if n["id"] == product["niche_id"]), None)
    keywords = niche.get("keywords", []) if niche else []

    prompt = (
        f"Product type: {product['product_type']}\n"
        f"Working title: {product['title']}\n"
        f"Niche keywords: {', '.join(keywords)}\n\n"
        "Write listing copy. Return JSON: "
        '{"title":"≤140 chars, front-loaded keywords",'
        '"description":"4-6 short paragraphs, scannable",'
        '"tags":["13 long-tail tags ≤20 chars each"],'
        '"price_usd":number,'
        '"confidence":0..1 — your honest score that this listing is publish-ready}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data:
        return {"ok": False, "error": "listing LLM failed"}

    listing = {
        "title": (data.get("title") or product["title"])[:140],
        "description": data.get("description", ""),
        "tags": [t[:20] for t in (data.get("tags") or [])][:13],
        "price_usd": float(data.get("price_usd", 7.99)),
        "confidence": float(data.get("confidence", 0.5)),
    }
    business_memory.update_product(product_id, listing=listing, status="listed")
    return {"ok": True, "listing": listing, "confidence": listing["confidence"]}
