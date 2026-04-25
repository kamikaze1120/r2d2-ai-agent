<div align="center">

<img src="docs/r2d2-hero.png" alt="R2D2 astromech droid" width="220" />

# R2D2

### Your local-first AI butler & autonomous business engine.

<br/>

[![Made by Mohammed](https://img.shields.io/badge/Made%20by-Mohammed-22d3ee?style=for-the-badge&labelColor=0f172a)](#)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=0f172a)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black&labelColor=0f172a)](#)
[![Ollama](https://img.shields.io/badge/LLM-Ollama-000?style=for-the-badge&logo=ollama&logoColor=white&labelColor=0f172a)](https://ollama.com)
[![ElevenLabs](https://img.shields.io/badge/Voice-ElevenLabs-7c3aed?style=for-the-badge&labelColor=0f172a)](https://elevenlabs.io)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&labelColor=0f172a)](#)

<br/>

```
"At your service, sir."  —  R2D2
```

</div>

---

## 🌌 What is R2D2?

R2D2 is a **two-piece** project:

| | |
|---|---|
| 🧠 **Agent core** (`r2d2-agent/`) | A local Python brain. Plans, calls tools, remembers things, and orchestrates a fleet of **sub-agents** (research, product, listing, marketing, strategy, upload). Runs on **your laptop**. |
| 🖥️ **Control panel** (`src/`) | A polished React cockpit. Stream chats, watch reasoning, toggle autonomous mode, and hear R2D2 speak in a refined voice. Runs in **the browser**. |

**Free models · your hardware · your data.** No cloud LLMs unless *you* wire one in.

---

## ✨ Highlights

- 🔒 **100% local inference** — Ollama runs the model on your machine.
- 🧩 **Multi-agent orchestration** — 6 specialised sub-agents, dispatched automatically.
- 🛠️ **Pluggable tools** — files, shell, web search, Etsy/Shopify/Pinterest, long-term memory.
- 🎙️ **Cinematic voice** — bring your own ElevenLabs key, stored in your browser.
- 🌠 **Live cockpit UI** — animated 3D orb, aurora background, collapsible sidebar.
- 🤖 **Autonomous mode** — R2D2 narrates milestones, asks proactive questions, and runs scheduled jobs.
- 📱 **Reach it anywhere** — expose with Cloudflare Tunnel and control from your phone.

---

## 🚀 Quick start (5 minutes)

> Even if you've never touched Python or Node before, follow these steps in order. You'll be talking to R2D2 by step 5.

### 📋 Prerequisites

| Tool | Why | Install |
|---|---|---|
| **Git** | To clone the repo | <https://git-scm.com/downloads> |
| **Python 3.10+** | The agent runs on it | <https://www.python.org/downloads/> *(check "Add Python to PATH" on Windows)* |
| **Node.js 20+** | Builds the web panel | <https://nodejs.org/en/download> |
| **Ollama** | Runs the local LLM | <https://ollama.com/download> |

> 💡 **Verify**: open a terminal and run `python3 --version`, `node --version`, `git --version`, `ollama --version`. If any are missing, install them first.

---

### 🪜 Step 1 — Clone the repo

```bash
git clone https://github.com/<your-username>/r2d2.git
cd r2d2
```

---

### 🪜 Step 2 — Pull a local model with Ollama

In a **new terminal**, install a model on your machine:

```bash
ollama pull llama3.2          # ⭐ recommended default — ~2 GB, fast
# alternatives:
# ollama pull mistral         # ~4 GB, stronger reasoning
# ollama pull phi3            # ~2 GB, great on weak hardware
# ollama pull qwen2.5         # ~4 GB, excellent tool use
```

Make sure Ollama is running in the background:

```bash
ollama serve     # usually auto-starts; only run if you see "connection refused"
```

✅ Test it:

```bash
ollama run llama3.2 "say hello"
```

---

### 🪜 Step 3 — Boot the R2D2 agent (Python)

Open a terminal in the project root and run:

<details open>
<summary><b>🍎 macOS / 🐧 Linux</b></summary>

```bash
cd r2d2-agent
chmod +x run.sh
./run.sh
```

</details>

<details>
<summary><b>🪟 Windows (PowerShell)</b></summary>

```powershell
cd r2d2-agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
python -m r2d2.server
```

</details>

The script:

1. Creates a virtual environment (`.venv/`)
2. Installs all Python dependencies (FastAPI, Pydantic, httpx, reportlab, Pillow, …)
3. **Loads all sub-agents automatically** (see [Sub-agents](#-sub-agents) below)
4. Starts the FastAPI server at **http://localhost:8000**

✅ Verify in another terminal:

```bash
curl http://localhost:8000/health
```

You should see `{"ok": true, "ollama": {...}, "agents": [...]}`.

> 💡 **Keep this terminal running.** The agent must stay alive while you use the panel.

---

### 🪜 Step 4 — Boot the web control panel (React)

Open **another** terminal in the project root:

```bash
# install JavaScript dependencies (first run only)
npm install
# or if you prefer bun:  bun install

# start the dev server
npm run dev
```

The panel will open at **http://localhost:5173** (or whatever port it announces).

---

### 🪜 Step 5 — First contact

1. Open the panel in your browser.
2. Go to **Settings** in the sidebar.
3. Confirm:
   - **API base URL** = `http://localhost:8000`
   - **Model** = the one you pulled (e.g. `llama3.2`)
4. Click **Save & reconnect**. The status pill should turn 🟢 **Online**.
5. (Optional) Add your **ElevenLabs API key** under *Settings → Voice* to give R2D2 a real voice.
6. Head to the **Cockpit**, type a command, hit ⏎.

🎉 R2D2 is now at your service.

---

## 🤖 Sub-agents

R2D2's brain is not a single model — it's a **dispatcher** that routes work to specialised sub-agents living in `r2d2-agent/r2d2/agents/`.

| Sub-agent | File | What it owns |
|---|---|---|
| 🔭 **Research** | `research_agent.py` | Niche scouting, trend analysis, keyword discovery |
| 🎨 **Product** | `product_agent.py` | Generates digital products (PDFs, ebooks, sticker packs, wall art) |
| 📝 **Listing** | `listing_agent.py` | Writes SEO titles, descriptions, tags |
| 📣 **Marketing** | `marketing_agent.py` | Pinterest pins, social copy, email blurbs |
| 🧭 **Strategy** | `strategy_agent.py` | Reviews performance, suggests pivots |
| 🚀 **Upload** | `upload_agent.py` | Publishes to Etsy / Shopify with safety checks |

### How they load

Sub-agents are **auto-discovered** at boot. When you run `./run.sh`, the dispatcher imports every module in `r2d2/agents/` and registers it. You should see something like this in the agent terminal:

```
[R2D2] Loaded sub-agent: research
[R2D2] Loaded sub-agent: product
[R2D2] Loaded sub-agent: listing
[R2D2] Loaded sub-agent: marketing
[R2D2] Loaded sub-agent: strategy
[R2D2] Loaded sub-agent: upload
[R2D2] Dispatcher ready · 6 agents online
R2D2 Business Engine starting on http://localhost:8000
```

### Add your own sub-agent

1. Create `r2d2-agent/r2d2/agents/my_agent.py`:

   ```python
   from r2d2.agents._llm import call_llm

   def run(task: dict) -> dict:
       """Called by the dispatcher when a task is routed here."""
       prompt = f"Do the thing for: {task['input']}"
       return {"ok": True, "output": call_llm(prompt)}
   ```

2. Restart `./run.sh`. The dispatcher picks it up automatically — no config edits.

3. The agent will now appear in **Tools → Agents** in the web panel.

### Connect platform integrations

The official platform clients live in `r2d2-agent/r2d2/tools_pkg/`:

- `etsy_tool.py` — OAuth 2.0 PKCE, listing publish, image upload
- `shopify_tool.py` — Admin REST API, product + collection assignment
- `pinterest_tool.py` — API v5, autonomous pinning
- `analytics_tool.py` — performance tracking & reports
- `file_generator.py` — PDF / PNG / ebook generation

Set the corresponding env vars before launching `./run.sh`:

```bash
export ETSY_CLIENT_ID=...
export ETSY_REFRESH_TOKEN=...
export SHOPIFY_STORE=mystore.myshopify.com
export SHOPIFY_ADMIN_TOKEN=...
export PINTEREST_ACCESS_TOKEN=...
./run.sh
```

Missing keys = those tools simply stay dormant. R2D2 will not crash.

---

## 🎙️ Give R2D2 a voice (ElevenLabs)

1. Grab a free key at <https://elevenlabs.io>.
2. In the panel, open **Settings → Voice**.
3. Paste your key and pick a profile. Recommended: **George — refined British**.

| Voice | Vibe |
|---|---|
| **George** ⭐ | Deep, refined British. Calm. Butler-like. |
| Brian | Warm American baritone. |
| Charlie | Crisp, polished. Younger. |
| Daniel | Authoritative British. |

> 🔑 The key is stored in your **browser** (localStorage) and forwarded server-side per request. It never gets baked into the code.

Toggle **Auto-speak** so R2D2 reads every reply aloud, or hit the speaker icon on any single message.

---

## 🌐 Reach R2D2 from your phone

The panel must reach the agent's HTTP API. If they're on different devices, run a tunnel:

```bash
# Cloudflare (free, recommended)
cloudflared tunnel --url http://localhost:8000

# or ngrok
ngrok http 8000
```

Copy the public HTTPS URL into **Settings → API base URL** in the panel. Done.

---

## 🏛️ Architecture

```
        ┌──────────────────────────────────┐
        │  Browser — React Control Panel   │
        │  • Cockpit · Chat · Tasks        │
        │  • 3D orb · TTS · Aurora UI      │
        └─────────────────┬────────────────┘
                          │ HTTP + NDJSON streaming
                          ▼
        ┌──────────────────────────────────┐
        │  http://localhost:8000           │
        │  FastAPI · Dispatcher            │
        ├──────────────────────────────────┤
        │  ▸ Ollama (local LLM)            │
        │  ▸ Sub-agents (6 specialists)    │
        │  ▸ Tools (fs · sh · web · APIs)  │
        │  ▸ Memory (sessions · JSON)      │
        │  ▸ Scheduler · Audit log         │
        └──────────────────────────────────┘
```

---

## 🛡️ Safety knobs

- 📁 File and shell tools are **sandboxed** to `~/.r2d2/workspace`.
- 🔐 Restrict shell with `R2D2_SHELL_ALLOWLIST=ls,cat,git ./run.sh`.
- 🏠 LAN lockdown: `R2D2_HOST=127.0.0.1 ./run.sh`.
- ✅ **Approval mode** in the panel holds risky publishes for human review.

See `r2d2-agent/README.md` for the full env var reference.

---

## 🐞 Troubleshooting

<details>
<summary><b>The status pill stays red — "Cannot reach R2D2 API"</b></summary>

- Is the agent terminal still running? It should say `R2D2 Business Engine starting on http://localhost:8000`.
- In the browser, open <http://localhost:8000/health> directly — does it return JSON?
- If you ran a tunnel, paste the HTTPS URL into **Settings → API base URL**.

</details>

<details>
<summary><b>"Agent up · Ollama down" warning</b></summary>

Ollama isn't running. In a terminal:
```bash
ollama serve
```
Then click **Reconnect** in Settings.

</details>

<details>
<summary><b>Voice doesn't speak</b></summary>

- ElevenLabs key set in **Settings → Voice**? It must start with `sk_…`.
- Check your browser console for `401` from `/api/tts` — usually a typo'd key.

</details>

<details>
<summary><b>Sub-agent not appearing</b></summary>

- Check the agent terminal log — did you see `[R2D2] Loaded sub-agent: <name>`?
- Module must define a top-level `run(task: dict) -> dict` function.
- Restart `./run.sh` after adding new files.

</details>

---

## 📜 License & credit

MIT. Built and maintained by **Mohammed**. R2-D2 is a trademark of its respective owner — this project is a fan-inspired homage and is not affiliated with Lucasfilm.

<div align="center">

<sub>⭐ If R2D2 makes your day a little smarter, drop a star.</sub>

</div>
