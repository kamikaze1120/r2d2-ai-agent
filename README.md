<div align="center">

<img src="docs/r2d2-hero.png" alt="R2D2 astromech droid" width="220" />

# R2D2

### Your local-first AI butler & autonomous business engine.

<br/>

[![Made by Mohammed](https://img.shields.io/badge/Made%20by-Mohammed-22d3ee?style=for-the-badge&labelColor=0f172a)](#)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=0f172a)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black&labelColor=0f172a)](#)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge&labelColor=0f172a)](#)

<br/>

```
"At your service, Sir."  —  R2D2
```

</div>

---

## What is R2D2?

R2D2 is a **two-piece** project:

| | |
|---|---|
| 🧠 **Agent core** (`r2d2-agent/`) | Python backend — plans tasks, calls tools, orchestrates sub-agents, remembers context. Runs on your machine. |
| 🖥️ **Control panel** (`src/`) | React 19 cockpit — stream chats, watch reasoning, manage tasks, hear R2D2 speak. Runs in the browser. |

---

## Highlights

- 🔀 **Any LLM** — Ollama (local/free), Claude, GPT-4o, Gemini, or any OpenAI-compatible endpoint (Groq, Together, LM Studio)
- 🧩 **8 sub-agents** — research, product, listing, upload, marketing, strategy, browser, email
- 🌐 **Browser automation** — Playwright navigates, clicks, fills forms, and scrapes any site
- 📧 **Email** — read, search, and send via SMTP/IMAP (Gmail, Outlook, etc.)
- 🎙️ **Cinematic voice** — ElevenLabs TTS, BYOK, George's refined British voice
- 📈 **Capability tiers** — R2D2 scales its ambitions to match your model (basic → standard → advanced)
- 🤖 **Autonomous mode** — scheduled jobs, proactive strategy reviews
- 🔒 **Local-first** — your data stays on your machine

---

## Quick Start (5 minutes)

### Prerequisites

| Tool | Why | Install |
|---|---|---|
| **Python 3.10+** | Agent backend | https://python.org/downloads |
| **Node.js 20+** | Web panel | https://nodejs.org |
| **Git** | Clone the repo | https://git-scm.com |
| **Ollama** *(optional)* | Free local LLM | https://ollama.com/download |

> If you have an API key for Claude, GPT-4o, or Gemini — you can skip Ollama entirely.

---

### Step 1 — Clone

```bash
git clone https://github.com/kamikaze1120/r2d2-ai-agent.git
cd r2d2-ai-agent
```

---

### Step 2 — Configure

```bash
cd r2d2-agent
cp .env.example .env   # then edit .env with your keys
```

The only required setting is which LLM provider to use. Pick one:

**Option A — Ollama (free, local)**
```bash
# Pull a model first:
ollama pull llama3.2      # 2 GB, fast, capability: basic
ollama pull mistral       # 4 GB, balanced, capability: standard
ollama pull qwen2.5       # 4 GB, excellent tool use, capability: standard

# .env:
R2D2_LLM_PROVIDER=ollama
R2D2_MODEL=llama3.2
```

**Option B — Anthropic Claude (recommended for full capability)**
```bash
# .env:
R2D2_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
R2D2_MODEL=claude-sonnet-4-6
```

**Option C — OpenAI / GPT**
```bash
# .env:
R2D2_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
R2D2_MODEL=gpt-4o
```

**Option D — Google Gemini**
```bash
# .env:
R2D2_LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
R2D2_MODEL=gemini-1.5-pro
```

**Option E — Custom OpenAI-compatible (Groq, Together, LM Studio…)**
```bash
# .env:
R2D2_LLM_PROVIDER=custom
CUSTOM_LLM_BASE_URL=https://api.groq.com/openai/v1
CUSTOM_LLM_API_KEY=gsk_...
R2D2_MODEL=llama-3.1-70b-versatile
```

You can also change the provider at any time from **Settings → LLM Provider** in the web panel — no restart needed.

---

### Step 3 — Boot the agent

**macOS / Linux:**
```bash
cd r2d2-agent
./run.sh
```

**Windows (PowerShell):**
```powershell
cd r2d2-agent
.\run.ps1
```

The script:
1. Creates a Python virtual environment (`.venv/`)
2. Installs all dependencies
3. Installs Playwright Chromium for browser automation
4. Starts the FastAPI server at **http://localhost:8000**

Verify it's running:
```bash
curl http://localhost:8000/health
```

---

### Step 4 — Boot the web panel

```bash
# from the project root
npm install
npm run dev
```

Open **http://localhost:5173** (or the port shown).

---

### Step 5 — First contact

1. Open the panel → **Settings**
2. Confirm **API base URL** = `http://localhost:8000`
3. Under **LLM Provider** — pick your provider and model, save
4. Status should show 🟢 online
5. Head to **Cockpit** and type a command

---

## Capability Tiers

R2D2 automatically adjusts its behaviour to match your model's capability:

| Tier | Models | What R2D2 can do |
|---|---|---|
| **basic** | Ollama <7B (phi3, llama3.2:1b) | Chat, file ops, simple Q&A |
| **standard** | Ollama 7–13B (mistral, qwen2.5, llama3.2) | Research, product generation, multi-step tasks |
| **advanced** | Claude, GPT-4o, Gemini 1.5 Pro, Ollama 70B | Full capability — browser, email, orchestration, strategy |

---

## Sub-agents

R2D2's brain dispatches tasks to specialised sub-agents. **Auto-discovered** at boot — drop a new `.py` file with an async `run(task)` function in `r2d2-agent/r2d2/agents/` and it loads automatically.

| Agent | What it owns |
|---|---|
| 🔭 **research_agent** | Niche scouting, trend analysis, keyword discovery |
| 🎨 **product_agent** | Generates digital products (PDFs, ebooks, wall art) |
| 📝 **listing_agent** | Writes SEO titles, descriptions, tags |
| 📣 **marketing_agent** | Pinterest pins, social copy |
| 🧭 **strategy_agent** | Reviews performance, suggests pivots (auto-triggers every 5 products) |
| 🚀 **upload_agent** | Publishes to Etsy / Shopify with confidence gating |
| 🌐 **browser_agent** | Playwright web automation — navigate, click, scrape, screenshot |
| 📧 **email_agent** | Read, search, and send email via SMTP/IMAP |

### Workflow chain (autonomous mode)

```
research_niches
  → create_product (×3)
      → create_listing
          → upload_product (held for approval if confidence < threshold)
              → generate_marketing
                  [every 5 products] → strategy_review
```

---

## Tools available to R2D2

| Tool | Description |
|---|---|
| `read_file` / `write_file` / `append_file` / `delete_file` | Workspace file ops |
| `list_dir` | List workspace directory |
| `shell` | Run shell commands (sandboxed, allowlist-configurable) |
| `web_search` | DuckDuckGo search (no key required) |
| `remember` / `recall` | Long-term memory (persistent JSON) |
| `datetime` | Current date and time |
| `calculate` | Evaluate math expressions |
| `browser_navigate` | Open a URL in Chromium |
| `browser_read` | Read page text |
| `browser_click` | Click an element |
| `browser_fill` | Fill a form field |
| `browser_screenshot` | Capture the current page |
| `browser_search` | Full browser-based web search |
| `browser_js` | Run JavaScript on the page |
| `email_send` | Send email via SMTP |
| `email_read` | Read recent emails (IMAP) |
| `email_search` | Search emails by subject/sender |
| `final_answer` | Deliver the response to the user |

---

## Platform integrations

Set these in `.env` — missing values just disable that platform:

```bash
# Etsy
ETSY_API_KEY=...          # from developers.etsy.com
ETSY_OAUTH_TOKEN=...      # access token from OAuth flow
ETSY_REFRESH_TOKEN=...    # for automatic token rotation
ETSY_SHOP_ID=...          # your shop numeric ID

# Shopify
SHOPIFY_STORE=mystore.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...

# Pinterest
PINTEREST_ACCESS_TOKEN=...
PINTEREST_BOARD_ID=...

# Email (SMTP/IMAP — works with Gmail App Passwords)
EMAIL_ADDRESS=you@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx   # App Password
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_IMAP_HOST=imap.gmail.com

# ElevenLabs voice (users can also set this in the web panel)
ELEVENLABS_API_KEY=sk_...
```

---

## Health check

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

A healthy response:
```json
{
  "ok": true,
  "version": "1.0.0",
  "llm": {
    "provider": "ollama",
    "model": "llama3.2",
    "ok": true,
    "capability_tier": "basic"
  },
  "agents": ["research_agent", "product_agent", "listing_agent", "upload_agent",
             "marketing_agent", "strategy_agent", "browser_agent", "email_agent"],
  "tools": ["read_file", "write_file", "shell", "web_search", "remember", "recall",
            "browser_navigate", "browser_read", "email_send", "email_read", ...]
}
```

---

## Safety

- File and shell tools are sandboxed to `~/.r2d2/workspace`
- Shell restricted with `R2D2_SHELL_ALLOWLIST=ls,cat,git`
- Approval mode holds low-confidence uploads for human review
- `R2D2_DRY_RUN=true` — no real writes to Etsy/Shopify/Pinterest
- LAN-only: `R2D2_HOST=127.0.0.1`

---

## Reach R2D2 from your phone

```bash
# Cloudflare (free)
cloudflared tunnel --url http://localhost:8000

# or ngrok
ngrok http 8000
```

Paste the public URL into **Settings → R2D2 API base URL**.

---

## Adding a custom sub-agent

1. Create `r2d2-agent/r2d2/agents/my_agent.py`:

```python
from r2d2.agents._llm import llm_text

TASK_TYPES = ["my_custom_task"]   # optional — maps task types to this agent

async def run(task: dict) -> dict:
    result = await llm_text(f"Do the thing: {task['payload'].get('input', '')}")
    return {"ok": True, "output": result}
```

2. Restart `./run.sh` — it loads automatically. No config edits needed.

---

## Architecture

```
        ┌──────────────────────────────────────────┐
        │  Browser — React 19 Control Panel        │
        │  Cockpit · Chat · Tasks · Analytics      │
        │  Settings: any LLM provider              │
        └──────────────────┬───────────────────────┘
                           │ HTTP + NDJSON streaming
                           ▼
        ┌──────────────────────────────────────────┐
        │  http://localhost:8000  (FastAPI)        │
        ├──────────────────────────────────────────┤
        │  LLM Client (unified provider layer)     │
        │    Ollama · Claude · OpenAI · Gemini     │
        │    Custom OpenAI-compatible endpoint     │
        ├──────────────────────────────────────────┤
        │  Dispatcher → 8 Sub-agents               │
        │  Tool registry (20+ tools)               │
        │    Browser (Playwright)                  │
        │    Email (SMTP/IMAP)                     │
        │    File ops · Shell · Web search         │
        │    Etsy · Shopify · Pinterest            │
        ├──────────────────────────────────────────┤
        │  Memory (JSON + file-locked)             │
        │  Scheduler · Audit log · Task queue      │
        └──────────────────────────────────────────┘
```

---

## License

MIT. Built and maintained by **Mujtaba Mohammed**. R2-D2 is a trademark of its respective owner — this project is a fan-inspired homage and is not affiliated with Lucasfilm.

<div align="center">
<sub>⭐ If R2D2 makes your day a little smarter, drop a star.</sub>
</div>
