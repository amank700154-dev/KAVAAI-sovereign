#!/usr/bin/env bash
set -e

echo "==============================================================="
echo "  KAVAAI SOVEREIGN - AIR-GAPPED INDUSTRIAL AI WORKBENCH"
echo "  SIH26117: Private Intelligence | Local Execution | Controlled Output"
echo "==============================================================="
echo ""

# 1. Check Python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    if command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python 3 is not installed."
        echo "Please install Python 3.10+."
        exit 1
    fi
fi

# 2. Ensure .env exists
if [ ! -f ".env" ]; then
    echo "[INFO] .env file not detected. Creating from .env.example..."
    cp .env.example .env
    echo "[OK] Default .env created with local loopback configuration."
fi

# 3. Check Ollama inference service
if command -v curl &> /dev/null; then
    if curl -s -f "http://127.0.0.1:11434/api/tags" > /dev/null; then
        echo "[OK] Ollama local inference service detected at http://127.0.0.1:11434."
    else
        echo "[WARNING] Local Ollama service is not responding at http://127.0.0.1:11434."
        echo "          For full AI reasoning and vision analysis, start Ollama ('ollama serve')."
        echo "          (Continuing in local-tools mode...)"
        echo ""
    fi
fi

# 4. Start Application Server
echo "[INFO] Starting KAVAAI Sovereign on http://127.0.0.1:8000 ..."
echo "[INFO] Press Ctrl+C to stop the server."
echo ""

# Optional browser open in background
(sleep 2 && (xdg-open "http://127.0.0.1:8000/" 2>/dev/null || open "http://127.0.0.1:8000/" 2>/dev/null || true)) &

$PYTHON_CMD backend/main.py
