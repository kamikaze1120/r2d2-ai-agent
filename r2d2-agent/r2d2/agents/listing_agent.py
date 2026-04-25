"""Listing agent: SEO title, description, tags + confidence score.

Uses few-shot examples of high-converting Etsy listings to anchor the LLM.
"""
from __future__ import annotations
from . import _llm
from ..memory import business_memory


SYSTEM = (
    "You are an Etsy and Shopify SEO copywriter. You write listing copy that "
    "ranks: keyword-rich titles (≤140 chars), conversion-focused descriptions, "
    "exactly 13 long-tail tags. You never invent features the file doesn't have."
)


FEW_SHOT = """\
EXAMPLE — high-converting planner listing (DO NOT copy verbatim, mimic structure):
{
  "title": "Daily Planner Printable PDF | Productivity Planner | Goal Setting Worksheet | Undated A4 Letter | Instant Download",
  "description": "✦ A clean, undated daily planner you can print today. Designed for focused mornings and shipping work that matters.\\n\\n✦ WHAT YOU GET\\n• 1 PDF (A4 + US Letter)\\n• Printable on home printer or at any print shop\\n• 4 sections: priorities, schedule, deep-work block, evening review\\n\\n✦ HOW IT WORKS\\n1. Buy → instant download\\n2. Print as many as you like\\n3. Use daily for focused execution\\n\\n✦ FOR PERSONAL USE ONLY. No physical product is shipped.",
  "tags": ["daily planner pdf","printable planner","productivity planner","goal setting","undated planner","focus planner","minimalist planner","letter size planner","a4 planner","instant download","planner insert","work planner","study planner"],
  "price_usd": 4.99,
  "confidence": 0.86
}

EXAMPLE — wall art:
{
  "title": "Stoic Wall Art Print | Marcus Aurelius Quote | Minimalist Office Decor | Printable PNG | Instant Download",
  "tags": ["stoic wall art","marcus aurelius","minimalist print","office decor","motivational quote","printable wall art","masculine decor","study room decor","focus print","daily reminder","stoic quote","modern poster","instant download"],
  "price_usd": 6.99,
  "confidence": 0.82
}
"""


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
        f"{FEW_SHOT}\n"
        f"NOW WRITE FOR THIS PRODUCT:\n"
        f"Product type: {product['product_type']}\n"
        f"Working title: {product['title']}\n"
        f"Niche keywords: {', '.join(keywords)}\n\n"
        "Write listing copy. Front-load the strongest 2 keywords in the title. "
        "Use unicode bullets (•, ✦) sparingly. Be honest about what's in the file.\n\n"
        "Return JSON: "
        '{"title":"≤140 chars","description":"4-6 short paragraphs",'
        '"tags":["13 long-tail tags ≤20 chars each"],'
        '"price_usd":number,'
        '"materials":["3-5 medium tags like \'pdf\',\'a4\',\'instant download\'"],'
        '"confidence":0..1 honest publish-ready score}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data:
        return {"ok": False, "error": "listing LLM failed"}

    listing = {
        "title": (data.get("title") or product["title"])[:140],
        "description": data.get("description", ""),
        "tags": [t[:20] for t in (data.get("tags") or [])][:13],
        "materials": [m[:45] for m in (data.get("materials") or [])][:5],
        "price_usd": float(data.get("price_usd", 7.99)),
        "confidence": float(data.get("confidence", 0.5)),
    }
    business_memory.update_product(product_id, listing=listing, status="listed")
    return {"ok": True, "listing": listing, "confidence": listing["confidence"]}
