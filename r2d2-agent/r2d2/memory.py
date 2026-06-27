"""Session and long-term memory backed by JSON files.

File locking (filelock) prevents corruption when the background worker
thread and FastAPI request handlers write concurrently.
"""
from __future__ import annotations
import json
import time
import uuid
from pathlib import Path
from . import config

try:
    from filelock import FileLock
    def _lock(path: Path) -> FileLock:
        return FileLock(str(path) + ".lock", timeout=10)
except ImportError:
    class _DummyLock:
        def __enter__(self): return self
        def __exit__(self, *_): pass
    def _lock(_path: Path):  # type: ignore[misc]
        return _DummyLock()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _read(path: Path) -> dict | list:
    if not path.exists():
        return {} if "session" in path.name else []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {} if "session" in path.name else []


def _write(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Sessions ─────────────────────────────────────────────────────────────────

def list_sessions() -> list[dict]:
    with _lock(config.SESSIONS_FILE):
        data = _read(config.SESSIONS_FILE)
        if isinstance(data, dict):
            return list(data.values())
        return data


def create_session(title: str | None = None) -> dict:
    sid = str(uuid.uuid4())
    session = {
        "id": sid,
        "title": title or f"Session {sid[:8]}",
        "created_at": time.time(),
        "messages": [],
    }
    with _lock(config.SESSIONS_FILE):
        data = _read(config.SESSIONS_FILE)
        if not isinstance(data, dict):
            data = {}
        data[sid] = session
        _write(config.SESSIONS_FILE, data)
    return session


def get_session(sid: str) -> dict | None:
    with _lock(config.SESSIONS_FILE):
        data = _read(config.SESSIONS_FILE)
        if isinstance(data, dict):
            return data.get(sid)
        return None


def append_message(sid: str, role: str, content: str) -> None:
    with _lock(config.SESSIONS_FILE):
        data = _read(config.SESSIONS_FILE)
        if not isinstance(data, dict):
            data = {}
        if sid not in data:
            data[sid] = {
                "id": sid,
                "title": f"Session {sid[:8]}",
                "created_at": time.time(),
                "messages": [],
            }
        data[sid].setdefault("messages", []).append({
            "role": role,
            "content": content,
            "ts": time.time(),
        })
        _write(config.SESSIONS_FILE, data)


def delete_session(sid: str) -> bool:
    with _lock(config.SESSIONS_FILE):
        data = _read(config.SESSIONS_FILE)
        if not isinstance(data, dict) or sid not in data:
            return False
        del data[sid]
        _write(config.SESSIONS_FILE, data)
    return True


# ── Long-term memories ────────────────────────────────────────────────────────

def list_memories() -> list[dict]:
    with _lock(config.MEMORY_FILE):
        data = _read(config.MEMORY_FILE)
        return data if isinstance(data, list) else []


def add_memory(text: str, tags: list[str] | None = None) -> dict:
    item = {
        "id": str(uuid.uuid4()),
        "text": text,
        "tags": tags or [],
        "created_at": time.time(),
    }
    with _lock(config.MEMORY_FILE):
        data = _read(config.MEMORY_FILE)
        if not isinstance(data, list):
            data = []
        data.append(item)
        _write(config.MEMORY_FILE, data)
    return item


def search_memories(query: str, limit: int = 10) -> list[dict]:
    q = query.lower()
    results = []
    for m in list_memories():
        text = m.get("text", "").lower()
        tags = " ".join(m.get("tags", [])).lower()
        if q in text or q in tags:
            results.append(m)
    return results[:limit]


def delete_memory(mid: str) -> bool:
    with _lock(config.MEMORY_FILE):
        data = _read(config.MEMORY_FILE)
        if not isinstance(data, list):
            return False
        before = len(data)
        data = [m for m in data if m.get("id") != mid]
        if len(data) == before:
            return False
        _write(config.MEMORY_FILE, data)
    return True
