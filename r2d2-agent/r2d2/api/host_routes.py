"""Filesystem + app-launch endpoints for R2D2's full-laptop autonomy.

These give the agent host-level capabilities. Mounted inside server.py via
`include_router`. Every operation is logged to the audit trail and is gated
by the workspace allowlist when ``R2D2_FS_RESTRICT=1`` (default).
"""
from __future__ import annotations

import os
import shlex
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import config
from ..core import audit_log

router = APIRouter(prefix="/host", tags=["host"])

# ----- Safety helpers -----

_RESTRICT = os.environ.get("R2D2_FS_RESTRICT", "1") == "1"
_ALLOWED_ROOTS = [Path(p).expanduser().resolve() for p in (
    str(config.WORKSPACE),
    os.environ.get("R2D2_FS_EXTRA_ROOT", ""),
) if p]


def _check_path(p: str) -> Path:
    target = Path(p).expanduser().resolve()
    if _RESTRICT and not any(
        str(target).startswith(str(root)) for root in _ALLOWED_ROOTS
    ):
        raise HTTPException(
            403,
            f"Path outside allowlist. Add R2D2_FS_EXTRA_ROOT or unset R2D2_FS_RESTRICT.",
        )
    return target


# ----- Schemas -----

class ListReq(BaseModel):
    path: str


class ReadReq(BaseModel):
    path: str
    max_bytes: int = 200_000


class WriteReq(BaseModel):
    path: str
    content: str


class OpenReq(BaseModel):
    """Open a URL or local app via the host shell."""
    target: str


# ----- Routes -----

@router.get("/fs/roots")
def fs_roots():
    return {
        "restrict": _RESTRICT,
        "allowed_roots": [str(r) for r in _ALLOWED_ROOTS],
    }


@router.post("/fs/list")
def fs_list(body: ListReq):
    p = _check_path(body.path)
    if not p.exists():
        raise HTTPException(404, "Not found")
    if not p.is_dir():
        raise HTTPException(400, "Not a directory")
    items = []
    for child in sorted(p.iterdir()):
        try:
            stat = child.stat()
            items.append({
                "name": child.name,
                "kind": "directory" if child.is_dir() else "file",
                "size": stat.st_size,
                "modified": int(stat.st_mtime),
            })
        except OSError:
            continue
    audit_log.log("agent", "host.fs.list", target=str(p), outcome="ok",
                  detail={"count": len(items)})
    return {"path": str(p), "entries": items}


@router.post("/fs/read")
def fs_read(body: ReadReq):
    p = _check_path(body.path)
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "Not found")
    data = p.read_bytes()[: body.max_bytes]
    audit_log.log("agent", "host.fs.read", target=str(p), outcome="ok",
                  detail={"bytes": len(data)})
    try:
        return {"path": str(p), "text": data.decode("utf-8")}
    except UnicodeDecodeError:
        return {"path": str(p), "binary": True, "bytes": len(data)}


@router.post("/fs/write")
def fs_write(body: WriteReq):
    p = _check_path(body.path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body.content, encoding="utf-8")
    audit_log.log("agent", "host.fs.write", target=str(p), outcome="ok",
                  detail={"bytes": len(body.content)})
    return {"ok": True, "path": str(p)}


@router.post("/launch")
def launch(body: OpenReq):
    """Open a URL in the default browser, or launch a local app by name.

    NEVER passes shell=True with user input. URLs go through the OS opener,
    bare app names use the platform launcher.
    """
    target = body.target.strip()
    if not target:
        raise HTTPException(400, "empty target")

    try:
        if target.startswith("http://") or target.startswith("https://"):
            if sys.platform == "darwin":
                subprocess.Popen(["open", target])
            elif sys.platform == "win32":
                os.startfile(target)  # type: ignore[attr-defined]
            else:
                subprocess.Popen(["xdg-open", target])
        else:
            # Treat as bare app name. shlex.split prevents injection.
            args = shlex.split(target)
            if sys.platform == "darwin":
                subprocess.Popen(["open", "-a", *args])
            elif sys.platform == "win32":
                subprocess.Popen(["cmd", "/c", "start", "", *args])
            else:
                subprocess.Popen(args)
        audit_log.log("agent", "host.launch", target=target, outcome="ok")
        return {"ok": True, "target": target}
    except Exception as e:  # noqa: BLE001
        audit_log.log("agent", "host.launch", target=target, outcome="error",
                      detail={"error": str(e)})
        raise HTTPException(500, str(e))
