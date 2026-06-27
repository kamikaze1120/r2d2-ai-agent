# ─────────────────────────────────────────────────────────────
#  R2D2 Agent — Windows PowerShell startup script
#  Usage: .\run.ps1
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Copy .env.example to .env if missing
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[R2D2] Created .env from .env.example — edit it to add API keys." -ForegroundColor Yellow
}

# Create virtualenv if missing
if (-not (Test-Path ".venv")) {
    Write-Host "[R2D2] Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

# Activate
& ".\.venv\Scripts\Activate.ps1"

# Install / upgrade dependencies
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt

# Install Playwright Chromium if not already done
$playwrightOk = $false
try {
    python -c "from playwright.sync_api import sync_playwright; p=sync_playwright().__enter__(); p.chromium.executable_path; p.__exit__(None,None,None)" 2>$null
    $playwrightOk = $true
} catch {}

if (-not $playwrightOk) {
    Write-Host "[R2D2] Installing Playwright Chromium browser..." -ForegroundColor Cyan
    python -m playwright install chromium | Out-Null
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          R2D2 — At Your Service, Sir.        ║" -ForegroundColor Cyan
Write-Host "║  Agent API : http://localhost:8000           ║" -ForegroundColor Cyan
Write-Host "║  Health    : http://localhost:8000/health    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

python -m r2d2.server
