"""Runtime configuration for R2D2."""
from __future__ import annotations
import os
from pathlib import Path

# Root data directory (memory, logs, db)
DATA_DIR = Path(os.environ.get("R2D2_DATA_DIR", Path.home() / ".r2d2"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

MEMORY_FILE = DATA_DIR / "long_term_memory.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"

# Ollama
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("R2D2_MODEL", "llama3.2")

# Server
HOST = os.environ.get("R2D2_HOST", "0.0.0.0")
PORT = int(os.environ.get("R2D2_PORT", "8000"))

ALLOWED_ORIGINS = os.environ.get("R2D2_ALLOWED_ORIGINS", "*").split(",")

# Sandbox: workspace directory for file ops, generated products, shell
WORKSPACE = Path(os.environ.get("R2D2_WORKSPACE", DATA_DIR / "workspace"))
WORKSPACE.mkdir(parents=True, exist_ok=True)
PRODUCTS_DIR = WORKSPACE / "products"
PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)

# Agent loop
MAX_ITERATIONS = int(os.environ.get("R2D2_MAX_ITERATIONS", "8"))
SHELL_ALLOWLIST = os.environ.get("R2D2_SHELL_ALLOWLIST")

# ----- Business engine -----
# Daily autonomous run cadence (seconds). Default 24h.
DAILY_RUN_INTERVAL_SECONDS = int(os.environ.get("R2D2_DAILY_RUN_SECONDS", "86400"))

# Approval threshold: products above this confidence auto-publish, below queue.
APPROVAL_THRESHOLD = float(os.environ.get("R2D2_APPROVAL_THRESHOLD", "0.8"))

# Persistent goal — drives the strategy agent.
SYSTEM_GOAL = os.environ.get(
    "R2D2_GOAL",
    "Generate and scale digital product revenue autonomously.",
)

# Etsy OAuth (https://www.etsy.com/developers)
ETSY_API_KEY = os.environ.get("ETSY_API_KEY")
ETSY_OAUTH_TOKEN = os.environ.get("ETSY_OAUTH_TOKEN")
ETSY_SHOP_ID = os.environ.get("ETSY_SHOP_ID")

# Shopify Admin API (https://shopify.dev)
SHOPIFY_STORE = os.environ.get("SHOPIFY_STORE")  # e.g. mystore.myshopify.com
SHOPIFY_ADMIN_TOKEN = os.environ.get("SHOPIFY_ADMIN_TOKEN")

# Action allowlist for autonomous execution.
# Comma list. Empty = all allowed. Useful: "research,generate,draft" to forbid uploads.
ACTION_ALLOWLIST = [x.strip() for x in
                    os.environ.get("R2D2_ACTION_ALLOWLIST", "").split(",")
                    if x.strip()]
