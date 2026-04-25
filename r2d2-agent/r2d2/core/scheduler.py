"""Autonomous scheduler — cron-style daily workflows with per-job interval edits."""
from __future__ import annotations
import asyncio
import threading
import time
from dataclasses import dataclass
from typing import Callable, Awaitable
from . import task_manager, audit_log
from .. import config


@dataclass
class ScheduledJob:
    name: str
    interval_seconds: int
    fn: Callable[[], Awaitable[None] | None]
    last_run: float = 0.0
    enabled: bool = True
    runs: int = 0
    last_error: str | None = None


class Scheduler:
    def __init__(self) -> None:
        self.jobs: list[ScheduledJob] = []
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._enabled = False
        self._lock = threading.Lock()

    def add(self, name: str, interval_seconds: int,
            fn: Callable[[], Awaitable[None] | None]) -> None:
        with self._lock:
            self.jobs.append(ScheduledJob(name=name,
                                          interval_seconds=interval_seconds,
                                          fn=fn))

    def status(self) -> dict:
        with self._lock:
            return {
                "enabled": self._enabled,
                "jobs": [
                    {
                        "name": j.name,
                        "interval_seconds": j.interval_seconds,
                        "last_run": j.last_run,
                        "runs": j.runs,
                        "enabled": j.enabled,
                        "last_error": j.last_error,
                    }
                    for j in self.jobs
                ],
            }

    def enable(self) -> None:
        with self._lock:
            if self._enabled:
                return
            self._enabled = True
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            audit_log.log("user", "scheduler.enable", outcome="ok")

    def disable(self) -> None:
        with self._lock:
            self._enabled = False
            self._stop.set()
            audit_log.log("user", "scheduler.disable", outcome="ok")

    def trigger(self, name: str) -> bool:
        for j in self.jobs:
            if j.name == name:
                self._run_job(j, force=True)
                return True
        return False

    def update_interval(self, name: str, seconds: int) -> bool:
        with self._lock:
            for j in self.jobs:
                if j.name == name:
                    j.interval_seconds = max(60, int(seconds))
                    audit_log.log("user", "scheduler.update_interval",
                                  target=name, outcome="ok",
                                  detail={"interval_seconds":
                                          j.interval_seconds})
                    return True
        return False

    def set_enabled(self, name: str, enabled: bool) -> bool:
        with self._lock:
            for j in self.jobs:
                if j.name == name:
                    j.enabled = bool(enabled)
                    audit_log.log("user", "scheduler.set_job_enabled",
                                  target=name, outcome="ok",
                                  detail={"enabled": j.enabled})
                    return True
        return False

    def _run_job(self, job: ScheduledJob, force: bool = False) -> None:
        try:
            res = job.fn()
            if asyncio.iscoroutine(res):
                asyncio.run(res)
            job.last_run = time.time()
            job.runs += 1
            job.last_error = None
            audit_log.log("scheduler", f"job.{job.name}",
                          outcome="ok",
                          detail={"forced": force, "runs": job.runs})
        except Exception as e:
            job.last_error = str(e)
            audit_log.log("scheduler", f"job.{job.name}",
                          outcome="error", detail={"error": str(e)})

    def _loop(self) -> None:
        while not self._stop.is_set():
            now = time.time()
            for job in list(self.jobs):
                if not job.enabled:
                    continue
                if now - job.last_run >= job.interval_seconds:
                    self._run_job(job)
            self._stop.wait(timeout=10)


scheduler = Scheduler()


# ---------------- Default jobs ----------------

def _seed_daily_business_run() -> None:
    parent = task_manager.create_task(
        "daily_business_run",
        {"goal": config.SYSTEM_GOAL},
        agent="strategy_agent",
        priority=10,
    )
    task_manager.create_task(
        "research_niches",
        {"limit": 5},
        agent="research_agent",
        parent_id=parent["id"],
        priority=9,
    )


def _seed_weekly_strategy_review() -> None:
    task_manager.create_task(
        "strategy_review",
        {"window_days": 30},
        agent="strategy_agent",
        priority=10,
    )


def _seed_daily_analytics_sync() -> None:
    """Pull views/sales from Etsy/Shopify into the local performance tracker."""
    from ..tools_pkg import analytics_tool
    from ..memory import business_memory
    products = business_memory.list_products(status="published")

    async def _go():
        await analytics_tool.sync_etsy_metrics(products)
        await analytics_tool.sync_shopify_metrics(products)

    try:
        asyncio.run(_go())
    except RuntimeError:
        # event loop already running (rare)
        pass


def register_default_jobs() -> None:
    interval = int(config.DAILY_RUN_INTERVAL_SECONDS)
    scheduler.add("daily_business_run", interval, _seed_daily_business_run)
    scheduler.add("daily_analytics_sync", interval, _seed_daily_analytics_sync)
    scheduler.add("weekly_strategy_review", interval * 7,
                  _seed_weekly_strategy_review)
