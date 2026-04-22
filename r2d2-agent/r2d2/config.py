"""Runtime configuration for R2D2."""
from __future__ import annotations
import os
from pathlib import Path

# Root data directory (memory, logs)
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

# CORS origins for the web control panel
ALLOWED_ORIGINS = os.environ.get(
    "R2D2_ALLOWED_ORIGINS",
    "*",
).split(",")

# Sandbox: workspace directory for file ops & shell commands
WORKSPACE = Path(os.environ.get("R2D2_WORKSPACE", DATA_DIR / "workspace"))
WORKSPACE.mkdir(parents=True, exist_ok=True)

# Safety: max iterations for the agent loop
MAX_ITERATIONS = int(os.environ.get("R2D2_MAX_ITERATIONS", "8"))

# Shell command allowlist (None = allow all, set comma list to restrict)
SHELL_ALLOWLIST = os.environ.get("R2D2_SHELL_ALLOWLIST")
