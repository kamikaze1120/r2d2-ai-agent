"""Runtime configuration for R2D2.

Loads from environment variables, with .env file support via python-dotenv.
All mutations (set_* functions) update module globals AND persist to settings_store
so changes survive restarts.
"""
from __future__ import annotations
import os
from pathlib import Path

# Load .env if present (silently skipped if file missing)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env", override=False)
except ImportError:
    pass


# ── Storage ────────────────────────────────────────────────────────────────
DATA_DIR = Path(os.environ.get("R2D2_DATA_DIR", Path.home() / ".r2d2")).expanduser()
DATA_DIR.mkdir(parents=True, exist_ok=True)

MEMORY_FILE    = DATA_DIR / "long_term_memory.json"
SESSIONS_FILE  = DATA_DIR / "sessions.json"
SETTINGS_FILE  = DATA_DIR / "settings.json"


# ── Server ─────────────────────────────────────────────────────────────────
HOST    = os.environ.get("R2D2_HOST", "0.0.0.0")
PORT    = int(os.environ.get("R2D2_PORT", "8000"))
ALLOWED_ORIGINS = os.environ.get("R2D2_ALLOWED_ORIGINS", "*").split(",")


# ── Sandbox ────────────────────────────────────────────────────────────────
WORKSPACE    = Path(os.environ.get("R2D2_WORKSPACE", DATA_DIR / "workspace")).expanduser()
WORKSPACE.mkdir(parents=True, exist_ok=True)
PRODUCTS_DIR = WORKSPACE / "products"
PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)


# ── LLM Provider ───────────────────────────────────────────────────────────
# R2D2_LLM_PROVIDER: ollama | anthropic | openai | gemini | custom
LLM_PROVIDER = os.environ.get("R2D2_LLM_PROVIDER", "ollama").lower()

# Ollama
OLLAMA_HOST   = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("R2D2_MODEL", "llama3.2")

# Anthropic Claude
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# OpenAI / OpenAI-compatible
OPENAI_API_KEY  = os.environ.get("OPENAI_API_KEY")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")

# Google Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Custom OpenAI-compatible endpoint (Groq, Together, LM Studio, Mistral, etc.)
CUSTOM_LLM_BASE_URL = os.environ.get("CUSTOM_LLM_BASE_URL", "")
CUSTOM_LLM_API_KEY  = os.environ.get("CUSTOM_LLM_API_KEY", "")


def get_capability_tier() -> str:
    """
    Returns 'basic' | 'standard' | 'advanced' based on the active provider/model.

    - advanced : frontier API models (Claude, GPT-4o, Gemini 1.5 Pro) — full JARVIS
    - standard : mid-size local models (7-13B) or cheaper APIs — research & products
    - basic    : small local models (<7B) — conversation, simple tasks
    """
    if LLM_PROVIDER == "anthropic":
        return "advanced"
    if LLM_PROVIDER == "openai":
        model = DEFAULT_MODEL.lower()
        return "standard" if "mini" in model or "3.5" in model else "advanced"
    if LLM_PROVIDER == "gemini":
        return "standard" if "flash" in DEFAULT_MODEL.lower() else "advanced"
    if LLM_PROVIDER == "custom":
        model = DEFAULT_MODEL.lower()
        if any(x in model for x in ["70b", "72b", "123b", "llama-3.1-70", "mixtral-8x22"]):
            return "advanced"
        if any(x in model for x in ["13b", "14b", "32b", "7b", "8b", "mixtral-8x7"]):
            return "standard"
        return "basic"
    # ollama
    model = DEFAULT_MODEL.lower()
    if any(x in model for x in ["70b", "72b", "llama3.1:70", "llama3.2:70", "mixtral:8x22"]):
        return "advanced"
    if any(x in model for x in ["13b", "14b", "32b", "7b", "8b", "mistral", "qwen2.5", "mixtral"]):
        return "standard"
    return "basic"


# ── Agent loop ─────────────────────────────────────────────────────────────
MAX_ITERATIONS = int(os.environ.get("R2D2_MAX_ITERATIONS", "12"))
SHELL_ALLOWLIST = os.environ.get("R2D2_SHELL_ALLOWLIST", "")


# ── Business engine ─────────────────────────────────────────────────────────
DAILY_RUN_INTERVAL_SECONDS = int(os.environ.get("R2D2_DAILY_RUN_SECONDS", "86400"))
APPROVAL_THRESHOLD = float(os.environ.get("R2D2_APPROVAL_THRESHOLD", "0.8"))
SYSTEM_GOAL = os.environ.get(
    "R2D2_GOAL",
    "Generate and scale digital product revenue autonomously.",
)
DRY_RUN = os.environ.get("R2D2_DRY_RUN", "false").lower() in ("1", "true", "yes")
ACTION_ALLOWLIST: list[str] = [
    x.strip()
    for x in os.environ.get("R2D2_ACTION_ALLOWLIST", "").split(",")
    if x.strip()
]


# ── Platform integrations ───────────────────────────────────────────────────
# Etsy
ETSY_API_KEY      = os.environ.get("ETSY_API_KEY")
ETSY_OAUTH_TOKEN  = os.environ.get("ETSY_OAUTH_TOKEN")
ETSY_REFRESH_TOKEN = os.environ.get("ETSY_REFRESH_TOKEN")
ETSY_SHOP_ID      = os.environ.get("ETSY_SHOP_ID")

# Shopify
SHOPIFY_STORE       = os.environ.get("SHOPIFY_STORE")
SHOPIFY_ADMIN_TOKEN = os.environ.get("SHOPIFY_ADMIN_TOKEN")

# Pinterest
PINTEREST_ACCESS_TOKEN = os.environ.get("PINTEREST_ACCESS_TOKEN")
PINTEREST_BOARD_ID     = os.environ.get("PINTEREST_BOARD_ID")

# Voice
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

# Email
EMAIL_ADDRESS   = os.environ.get("EMAIL_ADDRESS")
EMAIL_PASSWORD  = os.environ.get("EMAIL_PASSWORD")
EMAIL_SMTP_HOST = os.environ.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.environ.get("EMAIL_SMTP_PORT", "587"))
EMAIL_IMAP_HOST = os.environ.get("EMAIL_IMAP_HOST", "imap.gmail.com")


# ── Runtime mutators (persist to settings_store when available) ─────────────

def set_dry_run(flag: bool) -> None:
    global DRY_RUN
    DRY_RUN = bool(flag)
    _persist({"dry_run": DRY_RUN})

def set_approval_threshold(v: float) -> None:
    global APPROVAL_THRESHOLD
    APPROVAL_THRESHOLD = max(0.0, min(1.0, float(v)))
    _persist({"approval_threshold": APPROVAL_THRESHOLD})

def set_action_allowlist(items: list[str]) -> None:
    global ACTION_ALLOWLIST
    ACTION_ALLOWLIST = [x.strip() for x in items if x and x.strip()]
    _persist({"action_allowlist": ACTION_ALLOWLIST})

def set_llm_provider(provider: str, model: str | None = None,
                     api_key: str | None = None, base_url: str | None = None) -> None:
    global LLM_PROVIDER, DEFAULT_MODEL, ANTHROPIC_API_KEY
    global OPENAI_API_KEY, OPENAI_BASE_URL, GEMINI_API_KEY
    global CUSTOM_LLM_BASE_URL, CUSTOM_LLM_API_KEY
    LLM_PROVIDER = provider.lower()
    if model:
        DEFAULT_MODEL = model
    if api_key:
        if LLM_PROVIDER == "anthropic":
            ANTHROPIC_API_KEY = api_key
        elif LLM_PROVIDER == "openai":
            OPENAI_API_KEY = api_key
        elif LLM_PROVIDER == "gemini":
            GEMINI_API_KEY = api_key
        elif LLM_PROVIDER == "custom":
            CUSTOM_LLM_API_KEY = api_key
    if base_url:
        if LLM_PROVIDER == "openai":
            OPENAI_BASE_URL = base_url
        elif LLM_PROVIDER == "custom":
            CUSTOM_LLM_BASE_URL = base_url
    _persist({
        "llm_provider": LLM_PROVIDER,
        "default_model": DEFAULT_MODEL,
    })

def _persist(patch: dict) -> None:
    """Write a partial settings patch to disk (best-effort, never raises)."""
    try:
        import json
        from filelock import FileLock
        lock = FileLock(str(SETTINGS_FILE) + ".lock")
        with lock:
            data: dict = {}
            if SETTINGS_FILE.exists():
                try:
                    data = json.loads(SETTINGS_FILE.read_text())
                except Exception:
                    data = {}
            data.update(patch)
            SETTINGS_FILE.write_text(json.dumps(data, indent=2))
    except Exception:
        pass


def load_persisted_settings() -> None:
    """Call once at startup to restore settings saved by a previous process."""
    global DRY_RUN, APPROVAL_THRESHOLD, ACTION_ALLOWLIST
    global LLM_PROVIDER, DEFAULT_MODEL
    if not SETTINGS_FILE.exists():
        return
    try:
        import json
        data = json.loads(SETTINGS_FILE.read_text())
        if "dry_run" in data:
            DRY_RUN = bool(data["dry_run"])
        if "approval_threshold" in data:
            APPROVAL_THRESHOLD = float(data["approval_threshold"])
        if "action_allowlist" in data:
            ACTION_ALLOWLIST = data["action_allowlist"]
        if "llm_provider" in data:
            LLM_PROVIDER = data["llm_provider"]
        if "default_model" in data:
            DEFAULT_MODEL = data["default_model"]
    except Exception:
        pass
