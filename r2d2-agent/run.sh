#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  R2D2 Agent — macOS / Linux startup script
# ─────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

# Copy .env.example to .env if no .env exists yet
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "[R2D2] Created .env from .env.example — edit it to add API keys."
fi

# Create virtualenv if needed
if [ ! -d .venv ]; then
  echo "[R2D2] Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# Install Playwright browsers if not already installed
if ! python -c "from playwright.sync_api import sync_playwright; sync_playwright().__enter__().chromium.launch(headless=True).close()" 2>/dev/null; then
  echo "[R2D2] Installing Playwright Chromium browser..."
  python -m playwright install chromium --with-deps 2>/dev/null || true
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║          R2D2 — At Your Service, Sir.        ║"
echo "║  Agent API : http://localhost:8000           ║"
echo "║  Health    : http://localhost:8000/health    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

exec python -m r2d2.server
