@echo off
title Pharma-Connect AI - Server Launcher
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║         💊  PHARMA-CONNECT AI - Server Launcher  💊          ║
echo  ║         Real-Time Healthcare Intelligence Platform           ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: Navigate to the project directory
cd /d "%~dp0"

:: Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.10+ from https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo  [1/4] Checking Python version...
python --version
echo.

:: Check if virtual environment exists, create if not
if not exist "venv\Scripts\activate.bat" (
    echo  [2/4] Creating virtual environment...
    python -m venv venv
    echo        Virtual environment created successfully.
) else (
    echo  [2/4] Virtual environment found.
)
echo.

:: Activate virtual environment and install dependencies
echo  [3/4] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet --disable-pip-version-check 2>nul
echo        Dependencies installed successfully.
echo.

:: Initialize database if needed
echo  [4/4] Initializing database...
python -c "import db; db.init_db(); print('        Database ready.')"
echo.

echo  ════════════════════════════════════════════════════════════════
echo.
echo   Server starting on: http://localhost:8000
echo   API Documentation:   http://localhost:8000/docs
echo.
echo   Press Ctrl+C to stop the server.
echo.
echo  ════════════════════════════════════════════════════════════════
echo.

:: Open browser automatically after a short delay
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"

:: Start the FastAPI server with auto-reload for development
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
