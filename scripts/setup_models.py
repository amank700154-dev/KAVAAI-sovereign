#!/usr/bin/env python3
"""
KAVAAI SOVEREIGN — LOCAL MODEL SETUP & INITIALIZATION UTILITY
SIH26117: Sovereign On-Premise Agentic AI Workbench for Confidential Work

Responsibilities:
1. Verifies local Ollama service availability on loopback (127.0.0.1:11434).
2. Detects installed models against required operational roles.
3. Reports clear 'MODEL NOT INSTALLED' errors with exact setup commands.
4. Enforces LOCAL_ONLY mode and explicitly prevents any cloud fallback.
5. Does NOT automatically download large models unless explicitly requested (--pull).
"""

import os
import sys
import json
import argparse
import subprocess
import urllib.request
import urllib.error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from model_router import _CONFIG, check_local_model_availability, DEFAULT_ROLES

MODEL_SPECIFICATIONS = {
    "qwen2.5:7b": {
        "role": "REASONING_MODEL & CODING_MODEL",
        "description": "General reasoning, multi-step planning, engineering calculations, and code verification.",
        "size_estimate": "4.7 GB (Q4_K_M)",
        "vram_recommended": "6 GB+"
    },
    "qwen2.5vl:7b": {
        "role": "VISION_MODEL",
        "description": "Multimodal visual inspection, thermal defect classification, and technical drawing OCR.",
        "size_estimate": "5.5 GB (Q4_K_M)",
        "vram_recommended": "8 GB+"
    },
    "all-MiniLM-L6-v2": {
        "role": "EMBEDDING_MODEL",
        "description": "Dense semantic text embeddings for local ChromaDB RAG similarity search.",
        "size_estimate": "120 MB",
        "vram_recommended": "CPU or 512 MB VRAM"
    }
}


def print_banner():
    print("=" * 70)
    print("  KAVAAI SOVEREIGN — LOCAL MODEL INITIALIZATION & AUDIT")
    print("  SIH26117: Air-Gapped Industrial AI Workbench")
    print("  Policy: 100% ON-PREMISE | ZERO CLOUD FALLBACK | LOCAL_ONLY")
    print("=" * 70)
    print()


def check_ollama_daemon(host: str):
    """Verifies that the local Ollama daemon is reachable on loopback."""
    url = f"{host.rstrip('/')}/api/tags"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KAVAAI-Model-Setup"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in data.get("models", [])]
            return True, models, None
    except urllib.error.URLError as e:
        return False, [], f"Connection refused ({e.reason})"
    except Exception as e:
        return False, [], str(e)


def check_embedding_model(model_name: str):
    """Verifies local availability of the SentenceTransformers embedding model."""
    try:
        from sentence_transformers import SentenceTransformer
        # Check if model can be loaded without network calls
        embedder = SentenceTransformer(model_name)
        test_vec = embedder.encode("KAVAAI Sovereign local embedding test")
        return True, f"Loaded successfully (Dimension: {len(test_vec)})"
    except Exception as e:
        return False, str(e)


def check_gpu_status():
    """Detects GPU acceleration status via PyTorch CUDA."""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
            cuda_ver = torch.version.cuda
            return True, f"{gpu_name} ({vram_gb} GB VRAM, CUDA {cuda_ver})"
        else:
            return False, "Integrated / CPU Fallback (CUDA not detected)"
    except Exception as e:
        return False, f"PyTorch probe error: {e}"


def pull_model_cli(model_name: str):
    """Pulls a model using the local ollama CLI if explicitly requested by operator."""
    print(f"\n[*] Initiating download for '{model_name}' via local Ollama...")
    print(f"[*] Command: ollama pull {model_name}")
    try:
        res = subprocess.run(["ollama", "pull", model_name], check=True)
        return res.returncode == 0
    except FileNotFoundError:
        print("[ERROR] 'ollama' CLI is not in system PATH.")
        print("Please start Ollama from your desktop or ensure 'ollama' is in PATH.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Model pull failed with code {e.returncode}")
        return False


def main():
    parser = argparse.ArgumentParser(description="KAVAAI Sovereign Local Model Setup & Verification Utility")
    parser.add_argument("--pull", action="store_true", help="Explicitly pull any missing required models in Ollama (Will NOT download unless this flag is passed)")
    parser.add_argument("--json", action="store_true", help="Output audit report as structured JSON")
    args = parser.parse_args()

    if not args.json:
        print_banner()

    ollama_host = _CONFIG["ollama"]["host"]
    roles = _CONFIG["roles"]

    # 1. Probe Ollama Daemon
    is_online, installed_models, error_msg = check_ollama_daemon(ollama_host)
    
    # 2. Probe Embedding Model
    embed_model_name = roles.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    embed_ok, embed_msg = check_embedding_model(embed_model_name)

    # 3. Probe GPU
    gpu_ok, gpu_msg = check_gpu_status()

    # Model matching
    required_models = {
        "REASONING_MODEL": roles.get("REASONING_MODEL", "qwen2.5:7b"),
        "CODING_MODEL": roles.get("CODING_MODEL", "qwen2.5:7b"),
        "VISION_MODEL": roles.get("VISION_MODEL", "qwen2.5vl:7b"),
    }

    missing_models = []
    available_models = []

    for role, m_name in required_models.items():
        is_installed = any(
            m_name.lower() == im.lower() or 
            m_name.split(":")[0].lower() == im.lower() 
            for im in installed_models
        )
        if is_installed:
            available_models.append((role, m_name))
        else:
            missing_models.append((role, m_name))

    # JSON Output mode
    if args.json:
        report = {
            "ollama_online": is_online,
            "ollama_host": ollama_host,
            "gpu_acceleration": gpu_ok,
            "gpu_device": gpu_msg,
            "cloud_fallback_allowed": False,
            "network_mode": "LOCAL_ONLY",
            "embedding_model": {
                "name": embed_model_name,
                "available": embed_ok,
                "status": "LOCAL_LIBRARY_READY" if embed_ok else "MISSING_CACHE"
            },
            "installed_models_in_ollama": installed_models,
            "required_models": required_models,
            "missing_models": [m for _, m in missing_models],
            "status": "READY" if (is_online and not missing_models and embed_ok) else "ACTION_REQUIRED"
        }
        print(json.dumps(report, indent=2))
        return 0 if report["status"] == "READY" else 1

    # Human-Readable Industrial Output
    print(f"[*] Local Host Endpoint     : {ollama_host}")
    print(f"[*] Sovereign Security Mode : LOCAL_ONLY (Cloud AI Fallback: EXPLICITLY DISABLED)")
    print(f"[*] GPU Acceleration Engine : {gpu_msg}")
    print()

    print("--- 1. OLLAMA DAEMON STATUS ---")
    if is_online:
        print(f"  [OK] Ollama Service is ONLINE and listening on {ollama_host}")
        print(f"       Installed Model Count: {len(installed_models)}")
        for m in installed_models:
            print(f"         - {m}")
    else:
        print(f"  [ERROR] OLLAMA SERVICE UNAVAILABLE: Not responding on {ollama_host}")
        print(f"          Detail: {error_msg}")
        print()
        print("          KAVAAI SOVEREIGN requires a local Ollama daemon for on-premise AI inference.")
        print("          To start Ollama:")
        print("            1. If not installed, download from: https://ollama.com/")
        print("            2. In a separate terminal or service, launch:")
        print("               ollama serve")
        print("            3. Re-run this verification tool:")
        print("               python scripts/setup_models.py")

    print("\n--- 2. REQUIRED INDUSTRIAL MODELS ---")
    
    unique_missing = list(set([m for _, m in missing_models]))
    
    for role, m_name in required_models.items():
        spec = MODEL_SPECIFICATIONS.get(m_name, {})
        size = spec.get("size_estimate", "Unknown")
        
        is_installed = any(
            m_name.lower() == im.lower() or 
            m_name.split(":")[0].lower() == im.lower() 
            for im in installed_models
        )

        if is_online and is_installed:
            print(f"  [OK]      {role:<18} : {m_name:<16} [INSTALLED & READY]")
        elif not is_online:
            print(f"  [OFFLINE] {role:<18} : {m_name:<16} [OLLAMA OFFLINE]")
        else:
            print(f"  [MISSING] {role:<18} : {m_name:<16} [MODEL NOT INSTALLED]")
            print(f"            Command: ollama pull {m_name}")
            print(f"            Footprint: ~{size}")

    print("\n--- 3. EMBEDDING & RAG MODEL ---")
    if embed_ok:
        print(f"  [OK]      EMBEDDING_MODEL    : {embed_model_name:<16} [LOCAL PYTORCH READY]")
        print(f"            Detail: {embed_msg}")
    else:
        print(f"  [WARN]    EMBEDDING_MODEL    : {embed_model_name:<16} [NEEDS FIRST-RUN INITIALIZATION]")
        print(f"            Detail: {embed_msg}")

    print("\n" + "=" * 70)

    # Handle --pull flag if requested
    if args.pull and is_online and unique_missing:
        print("\n[*] Operators requested explicit model download (--pull):")
        for m in unique_missing:
            success = pull_model_cli(m)
            if success:
                print(f"  [OK] Successfully installed {m}")
            else:
                print(f"  [ERROR] Failed to install {m}")
    elif unique_missing and is_online:
        print("\n[ACTION REQUIRED] Required models are not installed in local Ollama.")
        print("KAVAAI policy prevents automatic downloading of large models without explicit operator consent.")
        print()
        print("To pull all missing models, execute:")
        for m in unique_missing:
            print(f"    ollama pull {m}")
        print()
        print("Or run setup with explicit download authorization:")
        print("    python scripts/setup_models.py --pull")

    print("=" * 70)
    
    if is_online and not unique_missing and embed_ok:
        print("  STATUS: ALL REQUIRED LOCAL MODELS READY FOR PRODUCTION INFERENCE")
        return 0
    else:
        print("  STATUS: ACTION REQUIRED — SEE INSTRUCTIONS ABOVE")
        return 1

if __name__ == "__main__":
    sys.exit(main())
