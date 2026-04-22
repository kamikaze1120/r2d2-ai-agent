# R2D2 Agent (local core)

The Python brain. Runs on **your laptop**, talks to **Ollama**, exposes an
HTTP API on `http://localhost:8000` for the web control panel.

## 1. Install Ollama (one time)

macOS / Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```
Windows: download from https://ollama.com/download.

Pull a model (pick one):
```bash
ollama pull llama3.2          # fast, recommended default (~2GB)
ollama pull mistral           # good general purpose (~4GB)
ollama pull phi3              # tiny, runs on weak laptops (~2GB)
```

Make sure Ollama is running:
```bash
ollama serve   # usually starts automatically
```

## 2. Run R2D2

```bash
cd r2d2-agent
./run.sh
```
First run creates a venv and installs deps. Then the API is live at
`http://localhost:8000`.

Quick check:
```bash
curl http://localhost:8000/health
```

## 3. Connect the web control panel

Open the Lovable preview, go to **Settings**, enter `http://localhost:8000`
(or your tunnel URL — see below), pick a model, and start chatting.

## Exposing R2D2 to the web panel

The panel runs in a browser; localhost works only if you open the panel on
the same machine. To control R2D2 from anywhere, run a tunnel:

**Cloudflare Tunnel (free, recommended):**
```bash
brew install cloudflared            # or see cloudflared docs
cloudflared tunnel --url http://localhost:8000
```
Copy the printed `https://...trycloudflare.com` URL into the panel's API
base URL setting.

**ngrok:**
```bash
ngrok http 8000
```

## Configuration (env vars)

| Var | Default | Purpose |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama daemon |
| `R2D2_MODEL` | `llama3.2` | Default model |
| `R2D2_PORT` | `8000` | API port |
| `R2D2_WORKSPACE` | `~/.r2d2/workspace` | Where file/shell tools operate |
| `R2D2_SHELL_ALLOWLIST` | (unset) | Comma list, e.g. `ls,cat,git` |
| `R2D2_MAX_ITERATIONS` | `8` | Max agent loop steps |
| `R2D2_ALLOWED_ORIGINS` | `*` | CORS origins |

## Architecture

```
r2d2/
  config.py     # env-driven config
  llm.py        # Ollama client (chat + streaming)
  memory.py     # short-term sessions + long-term JSON memory
  tools.py      # pluggable tools (file, shell, web, memory)
  executor.py   # agent loop: plan -> tool -> observe -> repeat
  server.py     # FastAPI HTTP API
```

### Adding a tool

Open `r2d2/tools.py` and call `register({...})` with `name`, `description`,
JSON-schema `parameters`, and a `run(args) -> str` function (sync or async).

## Safety notes

- `shell` runs commands inside the workspace. Set `R2D2_SHELL_ALLOWLIST` to
  restrict which commands the agent can execute.
- `read_file` / `write_file` are sandboxed to the workspace — they refuse
  paths that escape it.
- Bind to `127.0.0.1` (not `0.0.0.0`) if you do not want LAN access:
  `R2D2_HOST=127.0.0.1 ./run.sh`.
