"""Dispatcher: maps task types to agents and orchestrates the workflow chain.

Auto-discovery: every .py file in this package that exports a top-level
async run(task: dict) -> dict function is automatically registered.
You can drop a new agent file in here and restart — no edits required.

Hardcoded chain (deterministic, no LLM in the loop):
  research_niches → create_product → create_listing
    → upload_product → generate_marketing
  strategy_review runs after every 5 completed products (autonomous mode)
  browser_task / email_task are routed to their dedicated agents
"""
from __future__ import annotations
import asyncio
import importlib
import pkgutil
import threading
from typing import Awaitable, Callable
from ..core import task_manager, audit_log
from ..memory import business_memory
from .. import config

# ── Agent registry (populated by auto-discovery below) ───────────────────────
AGENTS: dict[str, Callable[[dict], Awaitable[dict]]] = {}


def _discover_agents() -> None:
    """
    Scan every module in this package for an async run() function and register it.
    Module name becomes the agent key (e.g. research_agent → "research_niches" is
    the task type, but we also register by module name for direct dispatch).
    """
    import r2d2.agents as _pkg
    pkg_path = _pkg.__path__
    pkg_name = _pkg.__name__

    for _info in pkgutil.iter_modules(pkg_path):
        name = _info.name
        if name.startswith("_") or name == "dispatcher":
            continue
        try:
            mod = importlib.import_module(f"{pkg_name}.{name}")
            fn = getattr(mod, "run", None)
            if callable(fn) and asyncio.iscoroutinefunction(fn):
                # Register by module name (e.g. "research_agent") AND
                # by the TASK_TYPE constant if the module defines one.
                AGENTS[name] = fn
                for task_type in getattr(mod, "TASK_TYPES", []):
                    AGENTS[task_type] = fn
                print(f"[R2D2] Loaded sub-agent: {name}")
        except Exception as e:
            print(f"[R2D2] Warning: could not load agent '{name}': {e}")


_discover_agents()

# Print summary
print(f"[R2D2] Dispatcher ready · {len(AGENTS)} agent handlers online")


# ── Allowlist check ───────────────────────────────────────────────────────────

def _action_allowed(task_type: str) -> bool:
    if not config.ACTION_ALLOWLIST:
        return True
    return any(task_type.startswith(p) or p in task_type
               for p in config.ACTION_ALLOWLIST)


# ── Workflow chain ─────────────────────────────────────────────────────────────

_completed_products_count = 0

def _chain_after(task: dict, result: dict) -> None:
    """Hardcoded deterministic workflow. No LLM in this control loop."""
    global _completed_products_count
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
        _completed_products_count += 1
        # Trigger strategy review every 5 published products
        if _completed_products_count % 5 == 0:
            task_manager.create_task(
                "strategy_review",
                {"trigger": "auto", "products_published": _completed_products_count},
                agent="strategy_agent", priority=1,
            )


# ── Dispatch ──────────────────────────────────────────────────────────────────

async def dispatch(task: dict) -> dict:
    task_type = task["type"]

    # Try exact match, then prefix match (e.g. "research_agent" for "research_niches")
    handler = AGENTS.get(task_type)
    if not handler:
        for key, fn in AGENTS.items():
            if task_type.startswith(key.replace("_agent", "")):
                handler = fn
                break

    if not handler:
        return {"ok": False, "error": f"No handler registered for task type '{task_type}'"}

    if not _action_allowed(task_type):
        audit_log.log("dispatcher", f"task.{task_type}",
                      target=task["id"], outcome="blocked",
                      detail={"reason": "ACTION_ALLOWLIST"})
        return {"ok": False, "error": f"{task_type} blocked by ACTION_ALLOWLIST"}

    audit_log.log(task.get("agent") or "dispatcher", f"task.{task_type}",
                  target=task["id"], outcome="ok",
                  detail={"payload": task.get("payload")})
    try:
        result = await handler(task)
    except Exception as e:
        audit_log.log(task.get("agent") or "dispatcher", f"task.{task_type}",
                      target=task["id"], outcome="error", detail={"error": str(e)})
        return {"ok": False, "error": str(e)}
    return result


# ── Background worker pool ─────────────────────────────────────────────────────

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
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True, name="r2d2-worker")
    _worker_thread.start()
    audit_log.log("user", "automation.worker_start", outcome="ok")


def stop_worker() -> None:
    _stop.set()
    audit_log.log("user", "automation.worker_stop", outcome="ok")


def worker_status() -> dict:
    alive = _worker_thread.is_alive() if _worker_thread else False
    return {"alive": alive, "stats": task_manager.stats()}
