"""Persistent action audit log.

Every meaningful agent action — uploads, approvals, automation toggles, dry-run
decisions, platform API calls — gets a row here. The dashboard reads it.
"""
from __future__ import annotations
import json
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator
from .. import config


_DB = config.DATA_DIR / "audit.db"
_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          REAL NOT NULL,
    actor       TEXT NOT NULL,           -- agent name, "user", "scheduler"
    action      TEXT NOT NULL,           -- e.g. etsy.publish, automation.start
    target      TEXT,                    -- product_id / task_id / job_name
    outcome     TEXT NOT NULL,           -- ok | blocked | dry_run | error
    detail      TEXT                     -- JSON
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit(action);
"""


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    with _lock:
        c = sqlite3.connect(_DB)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()


def init_db() -> None:
    _DB.parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        c.executescript(SCHEMA)


def log(actor: str, action: str, *, target: str | None = None,
        outcome: str = "ok", detail: dict[str, Any] | None = None) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO audit (ts, actor, action, target, outcome, detail) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (time.time(), actor, action, target, outcome,
             json.dumps(detail or {}, default=str)),
        )


def list_entries(limit: int = 200, action: str | None = None,
                 outcome: str | None = None) -> list[dict]:
    sql = "SELECT * FROM audit WHERE 1=1"
    args: list[Any] = []
    if action:
        sql += " AND action LIKE ?"
        args.append(f"{action}%")
    if outcome:
        sql += " AND outcome = ?"
        args.append(outcome)
    sql += " ORDER BY ts DESC LIMIT ?"
    args.append(limit)
    with _conn() as c:
        rows = c.execute(sql, args).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["detail"] = json.loads(d["detail"]) if d["detail"] else {}
        except Exception:
            pass
        out.append(d)
    return out


init_db()
