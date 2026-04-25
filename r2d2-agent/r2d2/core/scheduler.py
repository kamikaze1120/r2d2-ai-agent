"""Autonomous scheduler — cron-style daily workflows.

Runs in a background thread. Toggleable via /automation endpoints.
Uses a simple internal tick loop instead of APScheduler to keep the dependency
surface tiny.
"""
from __future__ import annotations
import asyncio
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Awaitable
from . import task_manager
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

    def disable(self) -> None:
        with self._lock:
            self._enabled = False
            self._stop.set()

    def trigger(self, name: str) -> bool:
        """Manually trigger a job by name (regardless of schedule)."""
        for j in self.jobs:
            if j.name == name:
                self._run_job(j, force=True)
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
        except Exception as e:
            job.last_error = str(e)

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


# ---------------- Default daily business workflow ----------------

def _seed_daily_business_run() -> None:
    """Queues a research → product → listing → upload chain.

    The strategy_agent later prunes/scales based on performance data.
    """
    parent = task_manager.create_task(
        "daily_business_run",
        {"goal": "Generate and scale digital product revenue autonomously"},
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


def register_default_jobs() -> None:
    # Daily run: every 24h. Set to a smaller value for demos.
    interval = int(config.DAILY_RUN_INTERVAL_SECONDS)
    scheduler.add("daily_business_run", interval, _seed_daily_business_run)
