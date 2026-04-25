"""Strategy agent: reads performance data + business memory and decides
which products to scale, abandon, or double down on.

Output: a list of recommended next tasks (queued automatically).
"""
from __future__ import annotations
from . import _llm
from ..memory import business_memory
from ..analytics import performance_tracker
from ..core import task_manager
from .. import config


SYSTEM = (
    "You are the chief strategist of a digital product business. You read "
    "performance data and decide what to scale, kill, or test next. You are "
    "ruthless about cutting losers and doubling down on winners. You output "
    "structured decisions, never narrative."
)


async def run(task: dict) -> dict:
    products = business_memory.list_products()
    enriched = []
    for p in products:
        m = performance_tracker.product_metrics(p["id"])
        enriched.append({
            "id": p["id"], "title": p["title"], "type": p["product_type"],
            "status": p.get("status"),
            "views": m["views"], "sales": m["sales"],
            "revenue": m["revenue"], "conversion": m["conversion"],
        })

    overview = performance_tracker.overview(30)
    niches = business_memory.list_niches()

    prompt = (
        f"GOAL: {config.SYSTEM_GOAL}\n"
        f"30-day overview: {overview}\n"
        f"Active niches: {[{'id':n['id'],'name':n['name'],'status':n['status']} for n in niches[:10]]}\n"
        f"Products: {enriched[:30]}\n\n"
        "Decide next moves. Return JSON: "
        '{"scale":[product_id...],"kill":[product_id...],'
        '"test_more_in_niche":[niche_id...],'
        '"new_research_topics":["topic"...],'
        '"reasoning":"≤3 sentences"}'
    )
    decisions = await _llm.llm_json(prompt, system=SYSTEM) or {}

    queued = []
    for nid in decisions.get("test_more_in_niche", [])[:3]:
        t = task_manager.create_task(
            "create_product",
            {"niche_id": nid, "product_type": "planner_pdf"},
            agent="product_agent", priority=5,
        )
        queued.append(t["id"])
    for pid in decisions.get("scale", [])[:3]:
        t = task_manager.create_task(
            "generate_marketing", {"product_id": pid},
            agent="marketing_agent", priority=4,
        )
        queued.append(t["id"])
    for pid in decisions.get("kill", [])[:5]:
        business_memory.update_product(pid, status="archived")

    business_memory.record_experiment(
        label="strategy_run",
        hypothesis=decisions.get("reasoning", ""),
        outcome="queued",
        data=decisions,
    )
    return {"ok": True, "decisions": decisions, "queued_task_ids": queued}
