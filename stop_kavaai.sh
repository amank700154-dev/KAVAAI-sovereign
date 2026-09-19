#!/usr/bin/env bash

echo "[INFO] Stopping any active KAVAAI Sovereign server on port 8000..."

if command -v lsof &> /dev/null; then
    PID=$(lsof -ti:8000 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "[INFO] Terminating PID $PID ..."
        kill -9 $PID 2>/dev/null || true
        echo "[OK] KAVAAI Sovereign server stopped."
    else
        echo "[INFO] No process listening on port 8000."
    fi
elif command -v fuser &> /dev/null; then
    fuser -k 8000/tcp 2>/dev/null || true
    echo "[OK] KAVAAI Sovereign port cleared."
else
    pkill -f "backend/main.py" 2>/dev/null || true
    echo "[OK] Stopped any backend/main.py processes."
fi
