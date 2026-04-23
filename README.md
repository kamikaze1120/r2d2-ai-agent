<div align="center">

<img src="docs/r2d2-hero.png" alt="R2D2 astromech droid" width="240" />

# R2D2

### Your local-first AI butler — runs on your laptop, answers to **R2D2**.

[![Made by Mohammed](https://img.shields.io/badge/Made%20by-Mohammed-0a84ff?style=for-the-badge)](#)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](#)
[![Ollama](https://img.shields.io/badge/LLM-Ollama-000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![ElevenLabs Voice](https://img.shields.io/badge/Voice-ElevenLabs-7c3aed?style=for-the-badge)](https://elevenlabs.io)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](#)

</div>

---

> *"At your service, Sir."* — R2D2

R2D2 is a **two-piece** project: a local Python agent that does the actual thinking, and a polished React control panel that lets you talk to it from any browser. Free models, your hardware, your data.

<table>
<tr>
<td width="50%" valign="top">

### 🧠 Agent core
**Python · FastAPI · Ollama**
Lives in `r2d2-agent/`. Runs on **your laptop**.
Plans, calls tools, remembers things — locally.

</td>
<td width="50%" valign="top">

### 🖥️ Control panel
**React · TanStack Start · Tailwind**
Lives in `src/`. Runs in **the browser**.
Chats, streams reasoning, speaks replies aloud.

</td>
</tr>
</table>

---

## ✨ Highlights

- 🔒 **100% local inference** — Ollama runs the model on your machine. No cloud LLM calls.
- 🛠️ **Pluggable tools** — files, shell, web search, long-term memory. Add your own in ~10 lines.
- 🧩 **Streaming agent loop** — watch R2D2 think → call tool → observe → answer, live.
- 🎙️ **JARVIS-style voice** — refined British TTS via ElevenLabs (toggleable, with per-message replay).
- 📱 **Reach it anywhere** — expose with Cloudflare Tunnel or ngrok and control it from your phone.
- 🎨 **Beautiful UI** — dark, minimal, semantic-token themed. No CSS spaghetti.

---

## 🚀 Quick start

<details open>
<summary><b>1 · Install Ollama and pull a model (one time)</b></summary>

```bash
curl -fsSL https://ollama.com/install.sh | sh   # macOS / Linux
ollama pull llama3.2                            # ~2 GB, recommended default
# alternatives:  ollama pull mistral  ·  ollama pull phi3
```

> **Windows:** download from <https://ollama.com/download>.

</details>

<details open>
<summary><b>2 · Boot the R2D2 agent on your laptop</b></summary>

```bash
cd r2d2-agent
chmod +x run.sh
./run.sh
```

This builds a venv, installs deps, and starts the API on `http://localhost:8000`. Verify:

```bash
curl http://localhost:8000/health
```

</details>

<details open>
<summary><b>3 · Open the web control panel</b></summary>

Open the published URL (or the Lovable preview), then go to **Settings**:

| Scenario | Action |
|---|---|
| Same machine | Leave API base URL as `http://localhost:8000` |
| Phone / different machine | Run a tunnel ↓ and paste the URL |

```bash
cloudflared tunnel --url http://localhost:8000
# or:
ngrok http 8000
```

Pick a model, click **Save & reconnect**, and start chatting.

</details>

---

## 🎙️ Give R2D2 a voice

Open **Settings → Voice** and pick a profile. Recommended: **George — refined British** (the JARVIS one).

| Voice | Vibe |
|---|---|
| **George** | Deep, refined British. Calm. Butler-like. |
| Brian | Warm American baritone. |
| Charlie | Crisp, polished. Younger. |
| Daniel | Authoritative British. |

Toggle **Auto-speak** to have R2D2 read every reply aloud, or hit the speaker icon on any message.

> 🔑 Voice runs through a server function so your `ELEVENLABS_API_KEY` never touches the browser.

---

## 🧰 Built-in tools

| Tool | What it does |
|---|---|
| `read_file` · `write_file` · `list_dir` | File ops, sandboxed to the workspace |
| `shell` | Run shell commands (with optional allowlist) |
| `web_search` | DuckDuckGo, no API key required |
| `remember` · `recall` | Long-term memory (JSON on disk) |
| `final_answer` | Return the result to you |

The loop: **plan → call tool → observe → repeat → final_answer**.

📂 Workspace: `~/.r2d2/workspace`  · 🧠 Memory: `~/.r2d2/long_term_memory.json`

---

## 🧪 Add your own tool

Edit `r2d2-agent/r2d2/tools.py`:

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

Restart the agent. The tool appears automatically on the **Tools** page and the planner picks it up.

---

## 🏛️ Architecture

```
        ┌────────────────────────────┐
        │  Browser (React panel)     │
        │  • Chat · Tools · Memory   │
        │  • ElevenLabs TTS playback │
        └─────────────┬──────────────┘
                      │  HTTP  (JSON + NDJSON streaming)
                      ▼
        ┌────────────────────────────┐
        │  http://localhost:8000     │
        │  FastAPI  ·  Agent loop    │
        ├────────────────────────────┤
        │  ├─ Ollama  (local LLM)    │
        │  ├─ Tools   (fs · sh · web)│
        │  └─ Memory  (sessions·JSON)│
        └────────────────────────────┘
```

**Why a tunnel?** Browsers can only reach `localhost` on the same physical machine. A tunnel gives the agent a public HTTPS URL so the panel can reach it from anywhere — without exposing your laptop directly.

---

## 🛡️ Safety

- 📁 File and shell tools are **sandboxed** to the workspace; escaping paths are rejected.
- 🔐 Restrict shell with `R2D2_SHELL_ALLOWLIST=ls,cat,git ./run.sh`.
- 🏠 Bind to localhost only with `R2D2_HOST=127.0.0.1 ./run.sh` to disable LAN access.
- 🔒 All model traffic stays on your machine. Nothing leaves it unless a tool explicitly does (e.g. `web_search`).

See `r2d2-agent/README.md` for the full env var reference.

---

## 📜 License & credit

MIT. Built and maintained by **Mohammed**. R2-D2 and J.A.R.V.I.S. are trademarks of their respective owners — this project is a fan-inspired homage, not affiliated with Lucasfilm or Marvel.

<div align="center">

<sub>⭐ If R2D2 makes your day a little smarter, drop a star.</sub>

</div>
