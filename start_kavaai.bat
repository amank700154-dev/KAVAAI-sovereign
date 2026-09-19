@echo off
setlocal enabledelayedexpansion

echo ===============================================================
echo   KAVAAI SOVEREIGN - AIR-GAPPED INDUSTRIAL AI WORKBENCH
echo   SIH26117: Private Intelligence ^| Local Execution ^| Controlled Output
echo ===============================================================
echo.

:: 1. Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in system PATH.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

:: 2. Ensure .env exists
if not exist .env (
    echo [INFO] .env file not detected. Creating from .env.example...
    copy .env.example .env >nul
    echo [OK] Default .env created with local loopback configuration.
)

:: 3. Check Ollama inference service
python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=2)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Local Ollama service is not responding at http://127.0.0.1:11434.
    echo           For full AI reasoning and vision analysis, ensure Ollama is running:
    echo           run 'ollama serve' and pull 'qwen2.5:7b' and 'qwen2.5vl:7b'.
    echo           (Continuing to start workbench in local-tools mode...)
    echo.
) else (
    echo [OK] Ollama local inference service detected at http://127.0.0.1:11434.
)

:: 4. Start Application Server
echo [INFO] Starting KAVAAI Sovereign on http://127.0.0.1:8000 ...
echo [INFO] Press Ctrl+C in this terminal to stop the server.
echo.

:: Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000/"

python backend/main.py

pause
