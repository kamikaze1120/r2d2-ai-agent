"""Tracks views / sales / revenue / conversion per product, per niche.

SQLite for fast aggregations. Backfill from Etsy/Shopify APIs in a daily job.
"""
from __future__ import annotations
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Iterator
from .. import config


_DB = config.DATA_DIR / "analytics.db"
_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  TEXT,
    niche_id    TEXT,
    platform    TEXT,
    kind        TEXT NOT NULL,   -- view | favorite | sale
    quantity    INTEGER DEFAULT 1,
    revenue     REAL DEFAULT 0,
    ts          REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_product ON events(product_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
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


def record(kind: str, *, product_id: str | None = None,
           niche_id: str | None = None, platform: str | None = None,
           quantity: int = 1, revenue: float = 0.0) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO events (product_id, niche_id, platform, kind, "
            "quantity, revenue, ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (product_id, niche_id, platform, kind, quantity, revenue, time.time()),
        )


def product_metrics(product_id: str) -> dict:
    with _conn() as c:
        rows = c.execute(
            "SELECT kind, SUM(quantity) AS q, SUM(revenue) AS r "
            "FROM events WHERE product_id=? GROUP BY kind",
            (product_id,),
        ).fetchall()
    out = {"views": 0, "favorites": 0, "sales": 0, "revenue": 0.0}
    for r in rows:
        if r["kind"] == "view":
            out["views"] = r["q"] or 0
        elif r["kind"] == "favorite":
            out["favorites"] = r["q"] or 0
        elif r["kind"] == "sale":
            out["sales"] = r["q"] or 0
            out["revenue"] = r["r"] or 0.0
    out["conversion"] = (out["sales"] / out["views"]) if out["views"] else 0.0
    return out


def niche_metrics(niche_id: str) -> dict:
    with _conn() as c:
        rows = c.execute(
            "SELECT kind, SUM(quantity) AS q, SUM(revenue) AS r "
            "FROM events WHERE niche_id=? GROUP BY kind",
            (niche_id,),
        ).fetchall()
    out = {"views": 0, "sales": 0, "revenue": 0.0}
    for r in rows:
        if r["kind"] == "view":
            out["views"] = r["q"] or 0
        elif r["kind"] == "sale":
            out["sales"] = r["q"] or 0
            out["revenue"] = r["r"] or 0.0
    return out


def overview(window_days: int = 30) -> dict:
    cutoff = time.time() - window_days * 86400
    with _conn() as c:
        row = c.execute(
            "SELECT COALESCE(SUM(CASE WHEN kind='view' THEN quantity END),0) AS views, "
            "COALESCE(SUM(CASE WHEN kind='sale' THEN quantity END),0) AS sales, "
            "COALESCE(SUM(CASE WHEN kind='sale' THEN revenue END),0) AS revenue "
            "FROM events WHERE ts >= ?",
            (cutoff,),
        ).fetchone()
    views = row["views"] or 0
    sales = row["sales"] or 0
    return {
        "window_days": window_days,
        "views": views,
        "sales": sales,
        "revenue": float(row["revenue"] or 0),
        "conversion": (sales / views) if views else 0.0,
    }


def daily_revenue(window_days: int = 30) -> list[dict]:
    cutoff = time.time() - window_days * 86400
    with _conn() as c:
        rows = c.execute(
            "SELECT CAST(ts/86400 AS INTEGER)*86400 AS day, "
            "SUM(CASE WHEN kind='sale' THEN revenue END) AS revenue, "
            "SUM(CASE WHEN kind='view' THEN quantity END) AS views "
            "FROM events WHERE ts >= ? GROUP BY day ORDER BY day ASC",
            (cutoff,),
        ).fetchall()
    return [
        {"day": r["day"], "revenue": float(r["revenue"] or 0),
         "views": int(r["views"] or 0)}
        for r in rows
    ]


init_db()


def funnel(window_days: int = 30) -> dict:
    cutoff = time.time() - window_days * 86400
    with _conn() as c:
        rows = c.execute(
            "SELECT kind, COALESCE(SUM(quantity),0) AS q, "
            "COALESCE(SUM(revenue),0) AS r FROM events "
            "WHERE ts >= ? GROUP BY kind",
            (cutoff,),
        ).fetchall()
    out = {"views": 0, "favorites": 0, "sales": 0, "revenue": 0.0}
    for r in rows:
        if r["kind"] == "view": out["views"] = int(r["q"])
        elif r["kind"] == "favorite": out["favorites"] = int(r["q"])
        elif r["kind"] == "sale":
            out["sales"] = int(r["q"]); out["revenue"] = float(r["r"])
    return out


def revenue_by_niche(window_days: int = 30) -> list[dict]:
    cutoff = time.time() - window_days * 86400
    with _conn() as c:
        rows = c.execute(
            "SELECT niche_id, "
            "COALESCE(SUM(CASE WHEN kind='sale' THEN revenue END),0) AS revenue, "
            "COALESCE(SUM(CASE WHEN kind='sale' THEN quantity END),0) AS sales, "
            "COALESCE(SUM(CASE WHEN kind='view' THEN quantity END),0) AS views "
            "FROM events WHERE ts >= ? AND niche_id IS NOT NULL "
            "GROUP BY niche_id ORDER BY revenue DESC",
            (cutoff,),
        ).fetchall()
    return [{"niche_id": r["niche_id"], "revenue": float(r["revenue"] or 0),
             "sales": int(r["sales"] or 0), "views": int(r["views"] or 0)}
            for r in rows]
