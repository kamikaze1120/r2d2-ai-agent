"""Structured business memory: niches, products, experiments, keyword performance.

Persisted as JSON for simplicity. Replace with SQLite if scale demands.
"""
from __future__ import annotations
import json
import threading
import time
import uuid
from typing import Any
from .. import config


_PATH = config.DATA_DIR / "business_memory.json"
_lock = threading.Lock()


def _read() -> dict[str, Any]:
    if not _PATH.exists():
        return {"niches": [], "products": [], "experiments": [],
                "keywords": [], "trends": []}
    try:
        return json.loads(_PATH.read_text())
    except Exception:
        return {"niches": [], "products": [], "experiments": [],
                "keywords": [], "trends": []}


def _write(d: dict) -> None:
    _PATH.write_text(json.dumps(d, indent=2, default=str))


def snapshot() -> dict:
    with _lock:
        return _read()


def add_niche(name: str, score: float, keywords: list[str],
              source: str = "research_agent") -> dict:
    item = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "score": score,
        "keywords": keywords,
        "source": source,
        "status": "candidate",  # candidate | active | abandoned | scaled
        "created_at": time.time(),
    }
    with _lock:
        d = _read()
        d["niches"].append(item)
        _write(d)
    return item


def update_niche_status(niche_id: str, status: str) -> bool:
    with _lock:
        d = _read()
        for n in d["niches"]:
            if n["id"] == niche_id:
                n["status"] = status
                n["updated_at"] = time.time()
                _write(d)
                return True
    return False


def add_product(niche_id: str, title: str, product_type: str,
                file_path: str | None = None,
                metadata: dict | None = None) -> dict:
    item = {
        "id": uuid.uuid4().hex[:10],
        "niche_id": niche_id,
        "title": title,
        "product_type": product_type,
        "file_path": file_path,
        "metadata": metadata or {},
        "status": "draft",  # draft | listed | published | archived
        "platform_ids": {},
        "created_at": time.time(),
    }
    with _lock:
        d = _read()
        d["products"].append(item)
        _write(d)
    return item


def update_product(product_id: str, **patch: Any) -> dict | None:
    with _lock:
        d = _read()
        for p in d["products"]:
            if p["id"] == product_id:
                p.update(patch)
                p["updated_at"] = time.time()
                _write(d)
                return p
    return None


def list_products(status: str | None = None) -> list[dict]:
    d = snapshot()
    items = d["products"]
    if status:
        items = [p for p in items if p.get("status") == status]
    return sorted(items, key=lambda p: p.get("created_at", 0), reverse=True)


def list_niches(status: str | None = None) -> list[dict]:
    d = snapshot()
    items = d["niches"]
    if status:
        items = [n for n in items if n.get("status") == status]
    return sorted(items, key=lambda n: n.get("score", 0), reverse=True)


def record_experiment(label: str, hypothesis: str, outcome: str,
                      data: dict | None = None) -> dict:
    item = {
        "id": uuid.uuid4().hex[:10],
        "label": label,
        "hypothesis": hypothesis,
        "outcome": outcome,
        "data": data or {},
        "created_at": time.time(),
    }
    with _lock:
        d = _read()
        d["experiments"].append(item)
        _write(d)
    return item


def record_keyword(keyword: str, score: float, niche_id: str | None = None) -> None:
    with _lock:
        d = _read()
        d["keywords"].append({
            "keyword": keyword, "score": score,
            "niche_id": niche_id, "ts": time.time(),
        })
        # keep last 1000
        d["keywords"] = d["keywords"][-1000:]
        _write(d)
