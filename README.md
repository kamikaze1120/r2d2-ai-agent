# R2D2 — Local-first AI Agent + Web Control Panel

Two pieces:

| Piece | Location | Runs where |
|---|---|---|
| **Agent core** (Python, FastAPI, Ollama) | `r2d2-agent/` | **Your laptop** |
| **Web control panel** (React, this Lovable project) | `src/` | Browser (talks to your laptop over HTTP) |

The panel sends commands to the agent. The agent does the actual thinking,
file/shell/web work, and remembers things — all locally, with free models.

---

## Quick start

### 1. Install Ollama and pull a model (one time)

```bash
curl -fsSL https://ollama.com/install.sh | sh   # macOS / Linux
ollama pull llama3.2                            # ~2GB, recommended default
# alternatives: ollama pull mistral · ollama pull phi3
```
Windows: download from <https://ollama.com/download>.

### 2. Run the R2D2 agent on your laptop

```bash
cd r2d2-agent
chmod +x run.sh
./run.sh
```
This creates a venv, installs dependencies, and starts the API on
`http://localhost:8000`. Verify:
```bash
curl http://localhost:8000/health
```

### 3. Open the web control panel

Open the published Lovable URL (or the preview). Go to **Settings**:

- **Same machine?** Leave the API base URL as `http://localhost:8000`.
- **Different machine / want to control from your phone?** Run a tunnel and paste the URL:
  ```bash
  cloudflared tunnel --url http://localhost:8000
  # or:  ngrok http 8000
  ```
  Paste the printed `https://...trycloudflare.com` (or ngrok URL) into the panel.

Pick a model from the dropdown, click **Save & reconnect**, then chat.

---

## What R2D2 can do out of the box

Built-in tools the agent can call:

- `read_file`, `write_file`, `list_dir` — files inside the workspace
- `shell` — run shell commands (with optional allowlist)
- `web_search` — DuckDuckGo, no API key
- `remember`, `recall` — long-term memory (JSON on disk)
- `final_answer` — return the answer to you

The agent loops: **plan → call tool → observe → repeat → final_answer**.

The workspace defaults to `~/.r2d2/workspace`. Long-term memory lives at
`~/.r2d2/long_term_memory.json`.

---

## Adding your own tool

Open `r2d2-agent/r2d2/tools.py` and call `register({...})`:

```python
def _my_tool(args):
    return f"Result for {args['x']}"

register({
    "name": "my_tool",
    "description": "What this does — the LLM reads this.",
    "parameters": {
        "type": "object",
        "properties": {"x": {"type": "string"}},
        "required": ["x"],
    },
    "run": _my_tool,
})
```

Restart the agent. The new tool shows up in the **Tools** page automatically
and the planner will pick it up.

---

## Architecture

```
Browser (Lovable web panel)
        │  HTTP (JSON + NDJSON streaming)
        ▼
http://localhost:8000  ──  FastAPI  ──  Agent loop
                                 │       │
                                 │       ├── Ollama (local LLM)
                                 │       ├── Tools (file, shell, web, memory)
                                 │       └── Memory (sessions + long-term JSON)
                                 │
                                 └── /health · /chat · /tools · /memories · /sessions
```

**Why a tunnel?** Browsers can only reach `localhost` on the same physical
machine. A tunnel gives the agent a public HTTPS URL so the panel can talk
to it from anywhere — without your laptop being directly exposed.

---

## Safety

- File and shell tools are sandboxed to the workspace; paths that escape it
  are rejected.
- Restrict the shell with `R2D2_SHELL_ALLOWLIST=ls,cat,git ./run.sh`.
- Bind to localhost only with `R2D2_HOST=127.0.0.1 ./run.sh` if you do not
  want LAN access.
- All model traffic goes to Ollama on your machine. Nothing leaves it
  unless a tool explicitly does (e.g. `web_search`).

See `r2d2-agent/README.md` for the full env var reference.
