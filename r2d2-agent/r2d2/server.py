"""FastAPI HTTP API — exposes R2D2 to the web control panel.

Run:
    python -m r2d2.server
or
    uvicorn r2d2.server:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from . import config, memory as legacy_memory, tools
from .executor import run_agent
from .llm import OllamaClient
from .core import task_manager, scheduler as sched_mod
from .memory import business_memory
from .analytics import performance_tracker
from .agents import dispatcher
from .tools_pkg import etsy_tool, shopify_tool


app = FastAPI(title="R2D2 Business Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Schemas -----

class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    model: str | None = None


class MemoryCreate(BaseModel):
    text: str
    tags: list[str] = []


class SessionCreate(BaseModel):
    title: str | None = None


class TaskCreate(BaseModel):
    type: str
    payload: dict = {}
    agent: str | None = None
    priority: int = 0


# ----- Health / status -----

@app.get("/health")
async def health():
    client = OllamaClient()
    ollama_ok = False
    models: list[str] = []
    try:
        ms = await client.list_models()
        ollama_ok = True
        models = [m.get("name") for m in ms]
    except Exception:
        pass
    finally:
        await client.aclose()
    return {
        "ok": True,
        "version": "0.2.0",
        "goal": config.SYSTEM_GOAL,
        "ollama": {"ok": ollama_ok, "host": config.OLLAMA_HOST, "models": models},
        "default_model": config.DEFAULT_MODEL,
        "workspace": str(config.WORKSPACE),
        "platforms": {
            "etsy": etsy_tool.configured(),
            "shopify": shopify_tool.configured(),
        },
        "approval_threshold": config.APPROVAL_THRESHOLD,
        "automation": dispatcher.worker_status(),
        "scheduler": sched_mod.scheduler.status(),
    }


@app.get("/models")
async def list_models():
    client = OllamaClient()
    try:
        return {"models": await client.list_models()}
    finally:
        await client.aclose()


# ----- Tools -----

@app.get("/tools")
def list_tools():
    return {"tools": [
        {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}
        for t in tools.all_tools()
    ]}


# ----- Sessions -----

@app.get("/sessions")
def get_sessions():
    return {"sessions": legacy_memory.list_sessions()}


@app.post("/sessions")
def post_session(body: SessionCreate):
    return legacy_memory.create_session(body.title)


@app.get("/sessions/{sid}")
def get_session(sid: str):
    s = legacy_memory.get_session(sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@app.delete("/sessions/{sid}")
def del_session(sid: str):
    if not legacy_memory.delete_session(sid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ----- Long-term memory -----

@app.get("/memories")
def get_memories():
    return {"memories": legacy_memory.list_memories()}


@app.post("/memories")
def post_memory(body: MemoryCreate):
    return legacy_memory.add_memory(body.text, body.tags)


@app.delete("/memories/{mid}")
def del_memory(mid: str):
    if not legacy_memory.delete_memory(mid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============================================================
# BUSINESS ENGINE — tasks, products, niches, analytics, automation
# ============================================================

# --- Tasks ---

@app.get("/tasks")
def list_tasks(status: str | None = None, type: str | None = None,
               limit: int = 200):
    return {"tasks": task_manager.list_tasks(status=status, type=type, limit=limit),
            "stats": task_manager.stats()}


@app.post("/tasks")
def create_task(body: TaskCreate):
    return task_manager.create_task(body.type, body.payload,
                                    agent=body.agent, priority=body.priority)


@app.get("/tasks/{tid}")
def get_task(tid: str):
    t = task_manager.get_task(tid)
    if not t:
        raise HTTPException(404, "Not found")
    return t


@app.post("/tasks/{tid}/approve")
def approve(tid: str):
    t = task_manager.approve_task(tid)
    if not t:
        raise HTTPException(404, "Not found")
    return t


@app.post("/tasks/{tid}/reject")
def reject(tid: str):
    t = task_manager.reject_task(tid)
    if not t:
        raise HTTPException(404, "Not found")
    return t


@app.delete("/tasks/{tid}")
def del_task(tid: str):
    if not task_manager.delete_task(tid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


# --- Niches & products (business memory) ---

@app.get("/niches")
def list_niches(status: str | None = None):
    return {"niches": business_memory.list_niches(status)}


@app.get("/products")
def list_products(status: str | None = None):
    items = business_memory.list_products(status)
    for p in items:
        p["metrics"] = performance_tracker.product_metrics(p["id"])
    return {"products": items}


@app.get("/products/{pid}/file")
def download_product_file(pid: str):
    p = next((x for x in business_memory.list_products()
              if x["id"] == pid), None)
    if not p or not p.get("file_path"):
        raise HTTPException(404, "Not found")
    return FileResponse(p["file_path"])


# --- Analytics ---

@app.get("/analytics/overview")
def analytics_overview(window_days: int = 30):
    return {
        "overview": performance_tracker.overview(window_days),
        "daily": performance_tracker.daily_revenue(window_days),
    }


# --- Automation control ---

@app.get("/automation")
def automation_status():
    return {
        "worker": dispatcher.worker_status(),
        "scheduler": sched_mod.scheduler.status(),
        "approval_threshold": config.APPROVAL_THRESHOLD,
        "action_allowlist": config.ACTION_ALLOWLIST,
    }


@app.post("/automation/start")
def automation_start():
    dispatcher.start_worker()
    sched_mod.scheduler.enable()
    return automation_status()


@app.post("/automation/stop")
def automation_stop():
    dispatcher.stop_worker()
    sched_mod.scheduler.disable()
    return automation_status()


@app.post("/automation/trigger/{job_name}")
def automation_trigger(job_name: str):
    ok = sched_mod.scheduler.trigger(job_name)
    if not ok:
        raise HTTPException(404, f"job {job_name} not found")
    return {"ok": True, "triggered": job_name}


# ----- Chat (streaming SSE-style NDJSON) -----

@app.post("/chat")
async def chat(req: ChatRequest):
    sid = req.session_id
    if not sid:
        sid = legacy_memory.create_session()["id"]

    async def gen():
        yield json.dumps({"type": "session", "session_id": sid}) + "\n"
        async for ev in run_agent(sid, req.message, model=req.model):
            yield json.dumps(ev) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


# ----- Bootstrap scheduler & worker -----

@app.on_event("startup")
def _startup() -> None:
    sched_mod.register_default_jobs()
    # Worker starts on user opt-in via /automation/start.
    # Pre-register but do not auto-enable scheduler.


def main():
    import uvicorn
    uvicorn.run("r2d2.server:app", host=config.HOST, port=config.PORT, reload=False)


if __name__ == "__main__":
    main()
