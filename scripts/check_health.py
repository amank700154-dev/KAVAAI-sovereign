"""
KAVAAI Sovereign - Standalone Health Check CLI
==============================================
SIH26117: Sovereign On-Premise Agentic AI Workbench

Executes structured verification across:
- Application
- Backend
- Ollama
- Reasoning Model
- Vision Model
- RAG
- ChromaDB
- Knowledge Base
- Required Directories
- GPU (Hardware acceleration)
- Security Mode
"""

import os
import sys
import json
import requests

# Configure safe UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPTS_DIR)
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def check_via_live_endpoint(url: str = "http://127.0.0.1:8000/api/health") -> dict:
    """Attempts to query the live running KAVAAI Sovereign server."""
    try:
        resp = requests.get(url, headers={"Accept": "application/json"}, timeout=4.0)
        return resp.json()
    except Exception:
        return None


def main():
    # 1. Attempt probe against live server first
    live_report = check_via_live_endpoint()
    
    if live_report and "summary_table" in live_report:
        print(live_report["summary_table"])
        print("\nDiagnostic Details (From Live Endpoint):")
        for comp, info in live_report.get("checks", {}).items():
            print(f"  * {comp:<20}: [{info['status']}] {info['details']}")
        print(f"\nOverall Status : {live_report.get('status')}")
        print(f"Timestamp      : {live_report.get('timestamp')}")
        return

    # 2. Fall back to direct in-process health checker
    try:
        from health_checker import run_all_health_checks
        local_report = run_all_health_checks()
        print(local_report["summary_table"])
        print("\nDiagnostic Details (In-Process Audit):")
        for comp, info in local_report.get("checks", {}).items():
            print(f"  * {comp:<20}: [{info['status']}] {info['details']}")
        print(f"\nOverall Status : {local_report.get('status')}")
        print(f"Timestamp      : {local_report.get('timestamp')}")
    except Exception as e:
        print(f"Error executing health check: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
