"""Short-term (per-session) and long-term (persistent JSON) memory."""
from __future__ import annotations
import json
import threading
import time
import uuid
from typing import Any
from . import config


_lock = threading.Lock()


def _read(path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _write(path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, default=str))


# ----- Sessions (short-term) -----

def list_sessions() -> list[dict]:
    with _lock:
        data = _read(config.SESSIONS_FILE)
    out = []
    for sid, s in data.items():
        out.append({
            "id": sid,
            "title": s.get("title") or "Untitled",
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
            "message_count": len(s.get("messages", [])),
        })
    return sorted(out, key=lambda x: x.get("updated_at") or 0, reverse=True)


def get_session(session_id: str) -> dict | None:
    with _lock:
        data = _read(config.SESSIONS_FILE)
    return data.get(session_id)


def create_session(title: str | None = None) -> dict:
    sid = uuid.uuid4().hex[:12]
    now = time.time()
    session = {
        "id": sid,
        "title": title or "New chat",
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    with _lock:
        data = _read(config.SESSIONS_FILE)
        data[sid] = session
        _write(config.SESSIONS_FILE, data)
    return session


def append_message(session_id: str, role: str, content: str, meta: dict | None = None) -> None:
    with _lock:
        data = _read(config.SESSIONS_FILE)
        session = data.get(session_id)
        if not session:
            return
        session["messages"].append({
            "role": role,
            "content": content,
            "ts": time.time(),
            "meta": meta or {},
        })
        session["updated_at"] = time.time()
        if session["title"] == "New chat" and role == "user":
            session["title"] = content[:60]
        _write(config.SESSIONS_FILE, data)


def delete_session(session_id: str) -> bool:
    with _lock:
        data = _read(config.SESSIONS_FILE)
        if session_id in data:
            del data[session_id]
            _write(config.SESSIONS_FILE, data)
            return True
    return False


# ----- Long-term memory (key facts / notes) -----

def list_memories() -> list[dict]:
    with _lock:
        data = _read(config.MEMORY_FILE)
    items = data.get("items", [])
    return sorted(items, key=lambda x: x.get("created_at", 0), reverse=True)


def add_memory(text: str, tags: list[str] | None = None) -> dict:
    item = {
        "id": uuid.uuid4().hex[:12],
        "text": text,
        "tags": tags or [],
        "created_at": time.time(),
    }
    with _lock:
        data = _read(config.MEMORY_FILE)
        items = data.get("items", [])
        items.append(item)
        data["items"] = items
        _write(config.MEMORY_FILE, data)
    return item


def delete_memory(memory_id: str) -> bool:
    with _lock:
        data = _read(config.MEMORY_FILE)
        items = data.get("items", [])
        new_items = [i for i in items if i.get("id") != memory_id]
        if len(new_items) == len(items):
            return False
        data["items"] = new_items
        _write(config.MEMORY_FILE, data)
    return True


def search_memories(query: str, limit: int = 5) -> list[dict]:
    """Lightweight substring/keyword search — good enough for laptop-scale memory."""
    q = query.lower()
    items = list_memories()
    scored: list[tuple[int, dict]] = []
    for i in items:
        text = i.get("text", "").lower()
        score = sum(1 for w in q.split() if w in text)
        if score:
            scored.append((score, i))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [i for _, i in scored[:limit]]
