"""Research agent: discovers profitable niches + keywords.

Combines LLM brainstorming with real Etsy keyword competition signals.
For each candidate niche the LLM proposes, we query Etsy's active-listings
endpoint to gauge competition density and adjust the score.
"""
from __future__ import annotations
import asyncio
from . import _llm
from ..memory import business_memory
from ..tools_pkg import etsy_tool
from .. import config


SYSTEM = (
    "You are a digital product market researcher specialising in Etsy and "
    "Shopify. You identify niches with strong evergreen demand, low to "
    "moderate competition, and clear buyer intent. You write concisely."
)


async def _enrich_with_etsy_signal(keywords: list[str]) -> dict:
    """Returns competition + popularity signal from Etsy search."""
    if not keywords:
        return {"competition": 0, "samples": []}
    queries = keywords[:3]
    results = await asyncio.gather(
        *[etsy_tool.search_trending_keywords(q, limit=5) for q in queries],
        return_exceptions=True,
    )
    counts = []
    samples: list[dict] = []
    for q, r in zip(queries, results):
        if isinstance(r, Exception) or not r.get("ok"):
            continue
        counts.append(r.get("count", 0))
        for item in r.get("items", [])[:2]:
            samples.append({"keyword": q,
                            "title": item.get("title", "")[:80],
                            "price": item.get("price", {}).get("amount")})
    avg = sum(counts) / len(counts) if counts else 0
    return {"competition": avg, "samples": samples}


def _adjust_score(base: float, competition: float) -> float:
    """High competition → reduce score; low competition + signal → boost."""
    if competition <= 0:
        return base
    if competition < 500:        # under-served
        return min(1.0, base + 0.10)
    if competition < 5000:        # healthy
        return base
    if competition < 30000:       # crowded
        return max(0.0, base - 0.10)
    return max(0.0, base - 0.20)  # saturated


async def run(task: dict) -> dict:
    payload = task.get("payload", {})
    limit = int(payload.get("limit", 5))

    prompt = (
        f"Goal: {config.SYSTEM_GOAL}\n\n"
        f"Suggest exactly {limit} digital product niches we should test this "
        "week. Favour evergreen + seasonal niches that already convert on "
        "Etsy (planners, printables, wedding, classroom, fitness, journaling, "
        "wall art quotes, sticker packs).\n\n"
        "For each niche return:\n"
        " - name (short, marketable)\n"
        " - score (0..1, gut-feel demand vs competition)\n"
        " - keywords (8 long-tail Etsy keywords, ≤20 chars each)\n"
        " - product_type (one of: planner_pdf, ebook_pdf, wall_art_png, sticker_pack)\n"
        " - rationale (1 sentence, audience + buyer intent)\n\n"
        'Return JSON: {"niches":[{"name":"","score":0.7,"keywords":[],'
        '"product_type":"","rationale":""}]}'
    )
    data = await _llm.llm_json(prompt, system=SYSTEM)
    if not data or "niches" not in data:
        return {"ok": False, "error": "research LLM returned no usable JSON"}

    saved = []
    for n in data["niches"][:limit]:
        signal = await _enrich_with_etsy_signal(n.get("keywords", []))
        adjusted = _adjust_score(float(n.get("score", 0.5)),
                                  signal["competition"])
        item = business_memory.add_niche(
            name=n.get("name", "untitled"),
            score=adjusted,
            keywords=n.get("keywords", [])[:15],
        )
        item["product_type"] = n.get("product_type", "planner_pdf")
        item["rationale"] = n.get("rationale", "")
        item["llm_score"] = float(n.get("score", 0.5))
        item["competition"] = signal["competition"]
        item["sample_listings"] = signal["samples"]
        # persist enrichment back to memory
        business_memory.update_niche_status(item["id"], "candidate")
        for kw in item["keywords"]:
            business_memory.record_keyword(kw, adjusted, niche_id=item["id"])
        saved.append(item)

    return {"ok": True, "niches": saved, "count": len(saved)}
