"""Research agent: discovers profitable niches + keywords.

Strategy: combine LLM brainstorming with simple keyword scoring.
A real implementation would also call EtsyHunt / eRank / Pinterest trends.
This stub uses the LLM only and stores results in business_memory.
"""
from __future__ import annotations
from . import _llm
from ..memory import business_memory
from .. import config


SYSTEM = (
    "You are a digital product market researcher specialising in Etsy and "
    "Shopify. You identify niches with strong evergreen demand, low to "
    "moderate competition, and clear buyer intent. You write concisely."
)


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    limit = int(payload.get("limit", 5))

    prompt = (
        f"Goal: {config.SYSTEM_GOAL}\n\n"
        f"Suggest exactly {limit} digital product niches we should test this "
        "week. For each, return:\n"
        " - name (short)\n - score (0..1, gut-feel demand vs competition)\n"
        " - keywords (8 long-tail Etsy keywords)\n"
        " - product_type (one of: planner_pdf, ebook_pdf, wall_art_png, sticker_pack)\n"
        " - rationale (1 sentence)\n\n"
        'Return JSON: {"niches":[{"name":"","score":0.7,"keywords":[],'
        '"product_type":"","rationale":""}]}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data or "niches" not in data:
        return {"ok": False, "error": "research LLM returned no usable JSON"}

    saved = []
    for n in data["niches"][:limit]:
        item = business_memory.add_niche(
            name=n.get("name", "untitled"),
            score=float(n.get("score", 0.5)),
            keywords=n.get("keywords", [])[:15],
        )
        item["product_type"] = n.get("product_type", "planner_pdf")
        item["rationale"] = n.get("rationale", "")
        saved.append(item)

    return {"ok": True, "niches": saved, "count": len(saved)}
