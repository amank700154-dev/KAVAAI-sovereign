@echo off
setlocal

echo [INFO] Stopping any active KAVAAI Sovereign server on port 8000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [INFO] Terminating process PID %%a ...
    taskkill /f /pid %%a >nul 2>&1
)

echo [OK] KAVAAI Sovereign processes stopped.
pause
