# ═══════════════════════════════════════════════════════════════
#  Pharma-Connect AI - PowerShell Server Launcher
#  Real-Time Healthcare & AI Intelligence Platform
# ═══════════════════════════════════════════════════════════════

$Host.UI.RawUI.WindowTitle = "Pharma-Connect AI Server"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║                                                          ║" -ForegroundColor Cyan
Write-Host "  ║    💊 PHARMA-CONNECT AI - Server Launcher 💊             ║" -ForegroundColor Cyan
Write-Host "  ║    Real-Time Healthcare Intelligence Platform            ║" -ForegroundColor Cyan
Write-Host "  ║                                                          ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Navigate to script directory
Set-Location $PSScriptRoot

# Step 1: Check Python
Write-Host "  [1/4] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "        $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Python not found. Install Python 3.10+ from https://python.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Virtual environment
Write-Host ""
if (-Not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "  [2/4] Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "        Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "  [2/4] Virtual environment found." -ForegroundColor Green
}

# Always use the venv python directly to avoid PATH issues on Windows
$VENV_PYTHON = ".\venv\Scripts\python.exe"

# Step 3: Install deps using venv pip
Write-Host ""
Write-Host "  [3/4] Installing/verifying dependencies..." -ForegroundColor Yellow
& $VENV_PYTHON -m pip install -r requirements.txt --quiet --disable-pip-version-check 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "        Dependencies ready." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Some packages may have failed. Trying verbose install..." -ForegroundColor Yellow
    & $VENV_PYTHON -m pip install -r requirements.txt
}

# Step 4: Initialize database
Write-Host ""
Write-Host "  [4/4] Initializing database..." -ForegroundColor Yellow
& $VENV_PYTHON -c "import db; db.init_db(); print('        Database ready.')"

Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Login Page:          " -NoNewline -ForegroundColor Green
Write-Host "http://localhost:8000/login" -ForegroundColor White
Write-Host "  ✅ Application:         " -NoNewline -ForegroundColor Green
Write-Host "http://localhost:8000" -ForegroundColor White
Write-Host "  ✅ API Docs:            " -NoNewline -ForegroundColor Green
Write-Host "http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Open browser at the LOGIN page (new dedicated login page)
Start-Process "http://localhost:8000/login"

# Start FastAPI server using venv's Python (avoids PATH issues on Windows)
& $VENV_PYTHON -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
