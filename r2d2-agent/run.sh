#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo ""
echo "R2D2 Business Engine starting on http://localhost:8000"
echo "Toggle automation from the web panel (Auto: ON button)."
echo ""
exec python -m r2d2.server
