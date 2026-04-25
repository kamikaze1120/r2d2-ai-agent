"""Persistent SQLite-backed task queue.

Tasks survive restarts. Statuses: pending | running | completed | failed | needs_approval.
Designed for the autonomous business engine — every agent action is a task row.
"""
from __future__ import annotations
import json
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any, Iterator
from .. import config


_DB_PATH = config.DATA_DIR / "tasks.db"
_lock = threading.RLock()


SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    payload         TEXT NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',
    priority        INTEGER NOT NULL DEFAULT 0,
    confidence      REAL,
    result          TEXT,
    error           TEXT,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    parent_id       TEXT,
    agent           TEXT,
    created_at      REAL NOT NULL,
    updated_at      REAL NOT NULL,
    started_at      REAL,
    finished_at     REAL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type   ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
"""


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    with _lock:
        c = sqlite3.connect(_DB_PATH)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()


def init_db() -> None:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.executescript(SCHEMA)


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    for k in ("payload", "result"):
        if d.get(k):
            try:
                d[k] = json.loads(d[k])
            except Exception:
                pass
    return d


def create_task(
    type: str,
    payload: dict | None = None,
    *,
    agent: str | None = None,
    priority: int = 0,
    parent_id: str | None = None,
    max_attempts: int = 3,
) -> dict:
    tid = uuid.uuid4().hex[:12]
    now = time.time()
    with _conn() as c:
        c.execute(
            """INSERT INTO tasks
               (id, type, payload, agent, priority, parent_id, max_attempts,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (tid, type, json.dumps(payload or {}), agent, priority,
             parent_id, max_attempts, now, now),
        )
    return get_task(tid)  # type: ignore[return-value]


def get_task(task_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_tasks(
    status: str | None = None,
    type: str | None = None,
    limit: int = 200,
) -> list[dict]:
    sql = "SELECT * FROM tasks WHERE 1=1"
    args: list[Any] = []
    if status:
        sql += " AND status = ?"
        args.append(status)
    if type:
        sql += " AND type = ?"
        args.append(type)
    sql += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with _conn() as c:
        rows = c.execute(sql, args).fetchall()
    return [_row_to_dict(r) for r in rows]


def claim_next(agent: str | None = None) -> dict | None:
    """Atomically claim the next pending task. Returns it as 'running'."""
    with _conn() as c:
        sql = ("SELECT * FROM tasks WHERE status='pending' "
               + ("AND (agent IS NULL OR agent=?) " if agent else "")
               + "ORDER BY priority DESC, created_at ASC LIMIT 1")
        args = (agent,) if agent else ()
        row = c.execute(sql, args).fetchone()
        if not row:
            return None
        now = time.time()
        c.execute(
            "UPDATE tasks SET status='running', started_at=?, updated_at=?, "
            "attempts=attempts+1 WHERE id=?",
            (now, now, row["id"]),
        )
    return get_task(row["id"])


def complete_task(task_id: str, result: dict | None = None,
                  confidence: float | None = None) -> dict | None:
    now = time.time()
    with _conn() as c:
        c.execute(
            "UPDATE tasks SET status='completed', result=?, confidence=?, "
            "finished_at=?, updated_at=? WHERE id=?",
            (json.dumps(result or {}), confidence, now, now, task_id),
        )
    return get_task(task_id)


def needs_approval(task_id: str, result: dict | None = None,
                   confidence: float | None = None) -> dict | None:
    now = time.time()
    with _conn() as c:
        c.execute(
            "UPDATE tasks SET status='needs_approval', result=?, confidence=?, "
            "updated_at=? WHERE id=?",
            (json.dumps(result or {}), confidence, now, task_id),
        )
    return get_task(task_id)


def fail_task(task_id: str, error: str, retry: bool = True) -> dict | None:
    now = time.time()
    with _conn() as c:
        row = c.execute("SELECT attempts, max_attempts FROM tasks WHERE id=?",
                        (task_id,)).fetchone()
        if not row:
            return None
        if retry and row["attempts"] < row["max_attempts"]:
            new_status = "pending"
        else:
            new_status = "failed"
        c.execute(
            "UPDATE tasks SET status=?, error=?, finished_at=?, updated_at=? "
            "WHERE id=?",
            (new_status, error, now, now, task_id),
        )
    return get_task(task_id)


def approve_task(task_id: str) -> dict | None:
    """Approval flips a needs_approval task back to pending for execution."""
    now = time.time()
    with _conn() as c:
        c.execute(
            "UPDATE tasks SET status='pending', updated_at=? WHERE id=? "
            "AND status='needs_approval'",
            (now, task_id),
        )
    return get_task(task_id)


def reject_task(task_id: str, reason: str = "rejected by user") -> dict | None:
    now = time.time()
    with _conn() as c:
        c.execute(
            "UPDATE tasks SET status='failed', error=?, finished_at=?, updated_at=? "
            "WHERE id=? AND status='needs_approval'",
            (reason, now, now, task_id),
        )
    return get_task(task_id)


def delete_task(task_id: str) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        return cur.rowcount > 0


def stats() -> dict[str, int]:
    with _conn() as c:
        rows = c.execute(
            "SELECT status, COUNT(*) AS n FROM tasks GROUP BY status"
        ).fetchall()
    out = {"pending": 0, "running": 0, "completed": 0, "failed": 0,
           "needs_approval": 0}
    for r in rows:
        out[r["status"]] = r["n"]
    out["total"] = sum(out.values())
    return out


init_db()
