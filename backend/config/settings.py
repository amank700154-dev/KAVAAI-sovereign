"""
KAVAAI Sovereign - Central Configuration Settings
=================================================
Centralizes all environment variables, local AI model roles, storage paths,
and air-gap network constraints in one clean, beginner-friendly module.
"""

import os
import json
from pathlib import Path

# Base Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
DATA_DIR = ROOT_DIR / "data"
WORKSPACE_DIR = ROOT_DIR / "workspace"
OUTPUT_DIR = WORKSPACE_DIR / "output"
KNOWLEDGE_BASE_DIR = ROOT_DIR / "knowledge_base"
VECTOR_STORE_DIR = ROOT_DIR / "chroma_db"
SAMPLE_DIR = DATA_DIR / "sample"

# Ensure runtime directories exist
for p in [DATA_DIR, WORKSPACE_DIR, OUTPUT_DIR, KNOWLEDGE_BASE_DIR, VECTOR_STORE_DIR, SAMPLE_DIR]:
    os.makedirs(str(p), exist_ok=True)

# Also ensure legacy output path works for backward compatibility
LEGACY_OUTPUT_DIR = ROOT_DIR / "output"
os.makedirs(str(LEGACY_OUTPUT_DIR), exist_ok=True)

# Local Ollama AI Settings
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get("OLLAMA_TIMEOUT", "90"))

# Model Roles
DEFAULT_ROLES = {
    "REASONING_MODEL": "qwen2.5:7b",
    "CODING_MODEL": "qwen2.5:7b",
    "VISION_MODEL": "qwen2.5vl:7b",
    "EMBEDDING_MODEL": "all-MiniLM-L6-v2"
}

# Load optional model_config.json from root
CONFIG_FILE = ROOT_DIR / "model_config.json"
MODEL_ROLES = dict(DEFAULT_ROLES)

if CONFIG_FILE.exists():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            disk_cfg = json.load(f)
            if "roles" in disk_cfg:
                MODEL_ROLES.update(disk_cfg["roles"])
            if "ollama" in disk_cfg:
                OLLAMA_HOST = disk_cfg["ollama"].get("host", OLLAMA_HOST)
                OLLAMA_TIMEOUT_SECONDS = disk_cfg["ollama"].get("timeout_seconds", OLLAMA_TIMEOUT_SECONDS)
    except Exception as e:
        print(f"[Settings] Warning: failed to parse {CONFIG_FILE}: {e}")

# Environment overrides
for role in DEFAULT_ROLES.keys():
    env_var = f"KAVAAI_{role}"
    if env_var in os.environ:
        MODEL_ROLES[role] = os.environ[env_var]

# Air-Gap Sovereignty Settings
AIR_GAP_ENFORCE_LOCAL_ONLY = True
ALLOW_EXTERNAL_WAN = False
LOOPBACK_ADDRESS = "127.0.0.1"
API_PORT = int(os.environ.get("PORT", "8000"))
API_HOST = os.environ.get("HOST", "127.0.0.1")

# Document limits
MAX_PDF_PAGES = 100
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
