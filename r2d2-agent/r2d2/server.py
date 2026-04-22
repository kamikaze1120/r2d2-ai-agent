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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from . import config, memory, tools
from .executor import run_agent
from .llm import OllamaClient


app = FastAPI(title="R2D2 Agent", version="0.1.0")

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
        "version": "0.1.0",
        "ollama": {"ok": ollama_ok, "host": config.OLLAMA_HOST, "models": models},
        "default_model": config.DEFAULT_MODEL,
        "workspace": str(config.WORKSPACE),
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
    return {"sessions": memory.list_sessions()}


@app.post("/sessions")
def post_session(body: SessionCreate):
    return memory.create_session(body.title)


@app.get("/sessions/{sid}")
def get_session(sid: str):
    s = memory.get_session(sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@app.delete("/sessions/{sid}")
def del_session(sid: str):
    if not memory.delete_session(sid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ----- Long-term memory -----

@app.get("/memories")
def get_memories():
    return {"memories": memory.list_memories()}


@app.post("/memories")
def post_memory(body: MemoryCreate):
    return memory.add_memory(body.text, body.tags)


@app.delete("/memories/{mid}")
def del_memory(mid: str):
    if not memory.delete_memory(mid):
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ----- Chat (streaming SSE-style NDJSON) -----

@app.post("/chat")
async def chat(req: ChatRequest):
    sid = req.session_id
    if not sid:
        sid = memory.create_session()["id"]

    async def gen():
        # First event: session id (so the client can pick it up if newly created)
        yield json.dumps({"type": "session", "session_id": sid}) + "\n"
        async for ev in run_agent(sid, req.message, model=req.model):
            yield json.dumps(ev) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


def main():
    import uvicorn
    uvicorn.run("r2d2.server:app", host=config.HOST, port=config.PORT, reload=False)


if __name__ == "__main__":
    main()
