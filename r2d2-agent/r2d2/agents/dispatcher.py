"""Deterministic dispatcher: maps task types to agents and orchestrates the
hardcoded workflow chain create_product → listing → upload → marketing.

The LLM is allowed inside agents for content; the dispatcher controls flow.
"""
from __future__ import annotations
import asyncio
import threading
from typing import Awaitable, Callable
from ..core import task_manager, audit_log
from ..memory import business_memory
from .. import config
from . import (research_agent, product_agent, listing_agent,
               upload_agent, marketing_agent, strategy_agent)


AGENTS: dict[str, Callable[[dict], Awaitable[dict]]] = {
    "research_niches":     research_agent.run,
    "create_product":      product_agent.run,
    "create_listing":      listing_agent.run,
    "upload_product":      upload_agent.run,
    "generate_marketing":  marketing_agent.run,
    "strategy_review":     strategy_agent.run,
}


def _action_allowed(task_type: str) -> bool:
    if not config.ACTION_ALLOWLIST:
        return True
    return any(task_type.startswith(p) or p in task_type
               for p in config.ACTION_ALLOWLIST)


def _chain_after(task: dict, result: dict) -> None:
    """Hardcoded workflow chain — strict, no LLM in this loop."""
    t = task["type"]
    if t == "research_niches" and result.get("ok"):
        for n in result.get("niches", [])[:3]:
            task_manager.create_task(
                "create_product",
                {"niche_id": n["id"],
                 "product_type": n.get("product_type", "planner_pdf")},
                agent="product_agent", priority=8, parent_id=task["id"],
            )
    elif t == "create_product" and result.get("ok"):
        pid = result["product"]["id"]
        task_manager.create_task(
            "create_listing", {"product_id": pid},
            agent="listing_agent", priority=7, parent_id=task["id"],
        )
    elif t == "create_listing" and result.get("ok"):
        pid = task["payload"].get("product_id")
        confidence = float(result.get("confidence", 0))
        upload_task = task_manager.create_task(
            "upload_product", {"product_id": pid, "platform": "etsy"},
            agent="upload_agent", priority=6, parent_id=task["id"],
        )
        if confidence < config.APPROVAL_THRESHOLD:
            task_manager.needs_approval(
                upload_task["id"],
                {"reason": "low listing confidence",
                 "confidence": confidence,
                 "listing_preview": result.get("listing")},
                confidence=confidence,
            )
            audit_log.log("dispatcher", "approval.held",
                          target=upload_task["id"], outcome="ok",
                          detail={"confidence": confidence,
                                  "threshold": config.APPROVAL_THRESHOLD})
    elif t == "upload_product" and result.get("ok") and result.get("auto_published"):
        pid = task["payload"].get("product_id")
        task_manager.create_task(
            "generate_marketing", {"product_id": pid},
            agent="marketing_agent", priority=3, parent_id=task["id"],
        )


async def dispatch(task: dict) -> dict:
    handler = AGENTS.get(task["type"])
    if not handler:
        return {"ok": False, "error": f"no handler for {task['type']}"}
    if not _action_allowed(task["type"]):
        audit_log.log("dispatcher", f"task.{task['type']}",
                      target=task["id"], outcome="blocked",
                      detail={"reason": "ACTION_ALLOWLIST"})
        return {"ok": False, "error": f"{task['type']} blocked by ACTION_ALLOWLIST"}
    audit_log.log(task.get("agent") or "dispatcher", f"task.{task['type']}",
                  target=task["id"], outcome="ok",
                  detail={"payload": task.get("payload")})
    try:
        result = await handler(task)
    except Exception as e:
        audit_log.log(task.get("agent") or "dispatcher",
                      f"task.{task['type']}", target=task["id"],
                      outcome="error", detail={"error": str(e)})
        return {"ok": False, "error": str(e)}
    return result


# ---------------- Background worker pool ----------------

_worker_thread: threading.Thread | None = None
_stop = threading.Event()


def _worker_loop() -> None:
    while not _stop.is_set():
        task = task_manager.claim_next()
        if not task:
            _stop.wait(timeout=3)
            continue
        try:
            result = asyncio.run(dispatch(task))
        except Exception as e:
            task_manager.fail_task(task["id"], str(e))
            continue
        if result.get("needs_approval"):
            task_manager.needs_approval(
                task["id"], result, confidence=result.get("confidence"))
        elif result.get("ok"):
            task_manager.complete_task(
                task["id"], result, confidence=result.get("confidence"))
            try:
                _chain_after(task, result)
            except Exception:
                pass
        else:
            task_manager.fail_task(task["id"], result.get("error", "unknown"))


def start_worker() -> None:
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        return
    _stop.clear()
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True)
    _worker_thread.start()
    audit_log.log("user", "automation.worker_start", outcome="ok")


def stop_worker() -> None:
    _stop.set()
    audit_log.log("user", "automation.worker_stop", outcome="ok")


def worker_status() -> dict:
    alive = _worker_thread.is_alive() if _worker_thread else False
    return {"alive": alive, "stats": task_manager.stats()}
