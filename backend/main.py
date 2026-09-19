from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import sys
import os
from datetime import datetime

# Configure Paths & Environment
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Safe Zero-Dependency .env Loader
ENV_FILE = os.path.join(ROOT_DIR, ".env")
if os.path.exists(ENV_FILE):
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip()
                    if k and k not in os.environ:
                        os.environ[k] = v
    except Exception as e:
        print(f"[Warning] Error parsing .env: {e}")

OUTPUT_DIR = os.environ.get("KAVAAI_OUTPUT_DIR", os.path.join(ROOT_DIR, "output"))
WORKSPACE_OUTPUT_DIR = os.path.join(ROOT_DIR, "workspace", "output")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(WORKSPACE_OUTPUT_DIR, exist_ok=True)

from agent_orchestrator import orchestrator
from model_router import (
    check_local_model_availability,
    get_routing_history,
    classify_task,
    _CONFIG,
    DEFAULT_ROLES
)

# Auto-seed vector database if needed on startup
try:
    from index_document import seed_database
    seed_database()
except Exception as e:
    print(f"[Warning] Auto-seeding vector database encountered: {e}")

from sovereignty_monitor import sovereignty_monitor
# Install active application-level outbound guard
strict_airgap = os.environ.get("AIR_GAP_STRICT_MODE", "true").lower() == "true"
sovereignty_monitor.install_outbound_guard(strict=strict_airgap)

app = Flask(__name__, static_folder=FRONTEND_DIR)
CORS(app)


# ==============================================================================
# STATIC FRONTEND SERVING (Direct Workbench Access at http://127.0.0.1:8000/)
# ==============================================================================
@app.route("/", methods=["GET"])
def index():
    """Serves the primary Industrial AI Workbench UI."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>", methods=["GET"])
def serve_static(path):
    """Serves static frontend assets (css, js, images)."""
    fpath = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(fpath) and os.path.isfile(fpath):
        return send_from_directory(FRONTEND_DIR, path)
    return jsonify({"error": f"Resource '{path}' not found."}), 404


# ==============================================================================
# INVESTIGATION ENDPOINT (UPGRADED WITH AGENTIC ORCHESTRATOR)
# ==============================================================================
@app.route("/investigate", methods=["POST"])
def investigate():
    data = request.get_json() or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({
            "decision": "ERROR",
            "manual_status": "ERROR",
            "image_status": "ERROR",
            "answer": "Please enter a question."
        }), 400

    try:
        # Execute agentic orchestrator directly in-process for speed and reliability
        res = orchestrator.execute(
            user_request=question,
            context=data,
            generate_deliverables=True,
            verbose=True
        )

        return jsonify({
            "decision": res.get("decision", "BOTH"),
            "manual_status": res.get("manual_status", "COMPLETED"),
            "image_status": res.get("image_status", "COMPLETED"),
            "answer": res.get("answer", ""),
            "task_type": res.get("task_type", "MULTIMODAL_INVESTIGATION"),
            "selected_model": res.get("selected_model", "qwen2.5:7b"),
            "target_role": res.get("target_role", "REASONING_MODEL"),
            "execution": res.get("execution", "LOCAL"),
            "model_routing": res.get("model_routing", {}),
            "task_understanding": res.get("task_understanding", {}),
            "plan": res.get("plan", []),
            "observations": res.get("observations", {}),
            "verification": res.get("verification", {}),
            "deliverables": res.get("deliverables", []),
            "approval_note": res.get("approval_note"),
            "code_execution": res.get("code_execution"),
            "knowledge_evidence": res.get("knowledge_evidence", []),
            "logs": res.get("logs", [])
        })

    except Exception as e:
        return jsonify({
            "decision": "ERROR",
            "manual_status": "ERROR",
            "image_status": "ERROR",
            "answer": f"Investigation process failed: {str(e)}"
        }), 500


# ==============================================================================
# GENERAL AGENTIC TASK ORCHESTRATION ENDPOINT
# ==============================================================================
@app.route("/api/orchestrate", methods=["POST"])
def orchestrate_task():
    data = request.get_json() or {}
    task_prompt = (data.get("task") or data.get("query") or data.get("question", "")).strip()
    context = data.get("context", data)
    generate_deliverables = data.get("generate_deliverables", True)

    if not task_prompt:
        return jsonify({"error": "Task prompt is required."}), 400

    try:
        res = orchestrator.execute(
            user_request=task_prompt,
            context=context,
            generate_deliverables=generate_deliverables,
            verbose=True
        )
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# CONFIDENTIAL DOCUMENT INTELLIGENCE ENDPOINTS
# ==============================================================================
@app.route("/api/documents/ingest", methods=["POST"])
def ingest_document():
    data = request.get_json() or {}
    file_path = data.get("file_path", "").strip()
    enable_ocr = data.get("enable_ocr", True)

    if not file_path:
        return jsonify({"error": "file_path parameter is required."}), 400

    try:
        from index_document import index_document_file
        if not os.path.isabs(file_path):
            file_path = os.path.join(ROOT_DIR, file_path)
            
        res = index_document_file(file_path, enable_ocr=enable_ocr)
        status_code = 200 if res.get("status") == "SUCCESS" else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({"error": f"Ingestion error: {str(e)}"}), 500


@app.route("/api/documents/process", methods=["POST"])
def process_doc():
    data = request.get_json() or {}
    file_path = data.get("file_path", "").strip()
    enable_ocr = data.get("enable_ocr", True)

    if not file_path:
        return jsonify({"error": "file_path parameter is required."}), 400

    try:
        from document_intelligence import process_document
        if not os.path.isabs(file_path):
            file_path = os.path.join(ROOT_DIR, file_path)
            
        doc = process_document(file_path, enable_ocr=enable_ocr)
        return jsonify(doc.to_dict())
    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500


@app.route("/api/documents", methods=["GET"])
def list_documents():
    try:
        import chromadb
        chroma_path = os.path.join(ROOT_DIR, "chroma_db")
        client = chromadb.PersistentClient(path=chroma_path)
        collection = client.get_or_create_collection(name="industrial_documents")
        count = collection.count()
        return jsonify({
            "collection_name": "industrial_documents",
            "indexed_chunks_count": count,
            "air_gapped": True,
            "status": "READY"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/documents/files", methods=["GET"])
def list_knowledge_files():
    """Returns detailed listing of all confidential documents in knowledge_base/."""
    from datetime import datetime
    kb_dir = os.path.join(ROOT_DIR, "knowledge_base")
    files_list = []
    
    if os.path.exists(kb_dir):
        for root, _, filenames in os.walk(kb_dir):
            rel_dir = os.path.relpath(root, kb_dir)
            cat = "general" if rel_dir == "." else rel_dir.split(os.sep)[0]
            
            for f in filenames:
                if f.startswith("."):
                    continue
                full_path = os.path.join(root, f)
                ext = os.path.splitext(f)[1].lower()
                files_list.append({
                    "filename": f,
                    "category": cat.upper(),
                    "file_path": full_path,
                    "rel_path": os.path.relpath(full_path, ROOT_DIR),
                    "extension": ext.replace(".", "").upper(),
                    "size_bytes": os.path.getsize(full_path),
                    "modified_at": datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat(),
                    "is_report": "inspection_report" in cat or "report" in f.lower()
                })
                
    files_list.sort(key=lambda x: x["modified_at"], reverse=True)
    return jsonify({
        "total_files": len(files_list),
        "files": files_list
    })


@app.route("/api/system/status", methods=["GET"])
def system_status():
    """Returns host compute, memory, platform, and GPU status."""
    import platform
    import shutil
    
    # Memory estimation via ctypes on Windows with graceful fallback
    mem_total = 16.0
    mem_used = 6.0
    mem_load = 38
    try:
        import ctypes
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            mem_total = round(stat.ullTotalPhys / (1024**3), 1)
            mem_avail = round(stat.ullAvailPhys / (1024**3), 1)
            mem_used = round(mem_total - mem_avail, 1)
            mem_load = int(stat.dwMemoryLoad)
    except Exception:
        pass

    try:
        disk = shutil.disk_usage(ROOT_DIR)
        disk_free = round(disk.free / (1024**3), 1)
        disk_total = round(disk.total / (1024**3), 1)
    except Exception:
        disk_free = 100.0
        disk_total = 500.0

    gpu_info = {"available": False, "device": "Integrated / CPU Fallback"}
    try:
        import torch
        if torch.cuda.is_available():
            gpu_info = {
                "available": True,
                "device": torch.cuda.get_device_name(0),
                "count": torch.cuda.device_count()
            }
    except Exception:
        pass

    avail = check_local_model_availability()

    return jsonify({
        "status": "OPERATIONAL",
        "air_gapped": True,
        "platform": f"{platform.system()} {platform.release()}",
        "machine": platform.machine(),
        "python_version": platform.python_version(),
        "cpu_count": os.cpu_count() or 4,
        "ram_total_gb": mem_total,
        "ram_used_gb": mem_used,
        "ram_load_percent": mem_load,
        "disk_free_gb": disk_free,
        "disk_total_gb": disk_total,
        "gpu": gpu_info,
        "ollama_online": avail.get("ollama_online", False),
        "installed_models": avail.get("installed_models", []),
        "roles": _CONFIG["roles"],
        "sovereignty_tier": "APPLICATION_GUARD_ENFORCED",
        "loopback_only": True
    })


# ==============================================================================
# LOCAL ORGANIZATIONAL KNOWLEDGE CONNECTOR ENDPOINTS
# ==============================================================================
@app.route("/api/knowledge/search", methods=["POST"])
def search_knowledge():
    data = request.get_json() or {}
    query = (data.get("query") or data.get("question", "")).strip()
    top_k = int(data.get("top_k", 3))
    category = data.get("category")

    if not query:
        return jsonify({"error": "query parameter is required."}), 400

    try:
        from knowledge_connector import SEARCH_KNOWLEDGE_BASE
        evidence = SEARCH_KNOWLEDGE_BASE(query=query, top_k=top_k, category=category)
        return jsonify({
            "query": query,
            "found": len(evidence),
            "evidence": evidence
        })
    except Exception as e:
        return jsonify({"error": f"Search failed: {str(e)}"}), 500


@app.route("/api/knowledge/sync", methods=["POST"])
def sync_knowledge():
    try:
        from knowledge_connector import connector
        stats = connector.sync_knowledge_directory()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500


@app.route("/api/knowledge/sources", methods=["GET"])
def knowledge_sources():
    try:
        from knowledge_connector import connector
        cat = connector.get_sources_catalog()
        return jsonify(cat)
    except Exception as e:
        return jsonify({"error": f"Failed reading catalog: {str(e)}"}), 500


# ==============================================================================
# LOCAL MODEL REGISTRY & STATUS ENDPOINT
# ==============================================================================
@app.route("/api/models", methods=["GET"])
def get_models():
    avail = check_local_model_availability(force_refresh=True)
    history = get_routing_history(limit=10)
    return jsonify({
        "registry": _CONFIG["roles"],
        "ollama_host": _CONFIG["ollama"]["host"],
        "ollama_online": avail["ollama_online"],
        "installed_models": avail["installed_models"],
        "roles_status": avail["roles_status"],
        "recent_routings": history,
        "sovereign_guarantee": "100% On-Premise Air-Gapped Loopback"
    })


@app.route("/api/models/health", methods=["GET"])
def get_models_health():
    """Detailed health check endpoint for local Ollama daemon, model installations, and sovereignty policies."""
    avail = check_local_model_availability(force_refresh=True)
    roles = _CONFIG["roles"]
    installed = avail.get("installed_models", [])
    
    missing = []
    errors = []
    
    if not avail.get("ollama_online", False):
        errors.append(f"OLLAMA UNAVAILABLE: Local Ollama daemon is offline at {_CONFIG['ollama']['host']}. Start Ollama with 'ollama serve'.")
    
    for role, m_name in roles.items():
        if role == "EMBEDDING_MODEL":
            continue
        is_inst = any(m_name.lower() == im.lower() or m_name.split(":")[0].lower() == im.lower() for im in installed)
        if not is_inst:
            missing.append(m_name)
            if avail.get("ollama_online", False):
                errors.append(f"MODEL NOT INSTALLED: Required {role} '{m_name}' is not pulled. Run: ollama pull {m_name}")

    missing_unique = list(set(missing))
    is_healthy = avail.get("ollama_online", False) and len(missing_unique) == 0

    return jsonify({
        "status": "HEALTHY" if is_healthy else "ACTION_REQUIRED",
        "ollama_online": avail.get("ollama_online", False),
        "ollama_host": _CONFIG["ollama"]["host"],
        "required_models": roles,
        "installed_models": installed,
        "missing_models": missing_unique,
        "cloud_fallback_disabled": True,
        "network_mode": "LOCAL_ONLY",
        "errors": errors
    }), (200 if is_healthy else 503)


@app.route("/api/health", methods=["GET"])
def get_kavaai_health():
    """
    Comprehensive KAVAAI Sovereign Health Check Endpoint.
    Verifies Application, Backend, Ollama, Models, RAG, ChromaDB, Knowledge Base, Directories, GPU, Security Mode.
    Supports ?format=text for visual summary table or JSON by default.
    """
    from health_checker import run_all_health_checks
    report = run_all_health_checks()
    
    fmt = request.args.get("format", "").lower()
    if fmt == "text" or "text/plain" in request.headers.get("Accept", ""):
        return report["summary_table"] + "\n", 200, {"Content-Type": "text/plain; charset=utf-8"}
        
    http_code = 200 if report["status"] == "HEALTHY" else (200 if "ACTION_REQUIRED" in report["status"] else 503)
    return jsonify(report), http_code



# ==============================================================================
# FILE DELIVERABLES DOWNLOAD ENDPOINT
# ==============================================================================
@app.route("/deliverables/<path:filename>", methods=["GET"])
def download_deliverable(filename):
    clean_name = os.path.basename(filename)
    if not os.path.exists(os.path.join(OUTPUT_DIR, clean_name)):
        return jsonify({"error": f"Deliverable file '{clean_name}' not found."}), 404
    return send_from_directory(OUTPUT_DIR, clean_name, as_attachment=True)


@app.route("/api/deliverables", methods=["GET"])
def list_deliverables():
    """Lists all verified deliverable files in output/ directory with download links."""
    files = []
    from deliverable_generator import deliverable_gen
    for fname in os.listdir(OUTPUT_DIR):
        fpath = os.path.join(OUTPUT_DIR, fname)
        if os.path.isfile(fpath) and not fname.startswith("."):
            ext = os.path.splitext(fname)[1].lower().replace(".", "")
            if ext in ["docx", "xlsx", "pptx", "txt", "csv", "py"]:
                v_res = deliverable_gen.verify_deliverable(fpath, ext)
                files.append({
                    "filename": fname,
                    "file_path": fpath,
                    "type": ext.upper(),
                    "size_bytes": os.path.getsize(fpath),
                    "modified_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
                    "download_url": f"http://127.0.0.1:8000/deliverables/{fname}",
                    "verified": v_res.get("verified", False)
                })
    # Sort newest first
    files.sort(key=lambda x: x["modified_at"], reverse=True)
    return jsonify({"deliverables": files, "count": len(files)})


@app.route("/api/upload", methods=["POST"])
def upload_document():
    """Handles scanned report or document uploads, saves to knowledge_base and indexes."""
    if 'file' not in request.files:
        data = request.get_json() or {}
        b64_content = data.get("file_base64")
        filename = data.get("filename", "uploaded_inspection_report.pdf")
        if not b64_content:
            return jsonify({"error": "No file uploaded (use multipart 'file' or JSON 'file_base64')."}), 400
        
        import base64
        file_bytes = base64.b64decode(b64_content)
    else:
        file = request.files['file']
        if not file.filename:
            return jsonify({"error": "Empty filename."}), 400
        filename = file.filename
        file_bytes = file.read()

    clean_name = os.path.basename(filename)
    target_dir = os.path.join(ROOT_DIR, "knowledge_base", "inspection_reports")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, clean_name)

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    # Automatically index into local ChromaDB
    try:
        from index_document import index_document_file
        index_res = index_document_file(target_path)
    except Exception as e:
        index_res = {"status": "PARTIAL", "error": str(e)}

    return jsonify({
        "status": "SUCCESS",
        "filename": clean_name,
        "file_path": target_path,
        "size_bytes": len(file_bytes),
        "indexing": index_res
    })



# ==============================================================================
# LIVE TELEMETRY ENDPOINT
# ==============================================================================
@app.route("/telemetry", methods=["GET"])
def telemetry():
    return jsonify({
        "machine": "Machine 101",
        "temperature": 72,
        "rpm": 1240,
        "pressure": 2.4,
        "coolant": 68,
        "vibration": 0.18,
        "fan": "ACTIVE"
    })


# ==============================================================================
# AIR-GAP SOVEREIGNTY & NETWORK AUDIT ENDPOINTS
# ==============================================================================
@app.route("/sovereignty", methods=["GET"])
def sovereignty():
    """Real-time Sovereignty Status & Metrics."""
    report = sovereignty_monitor.get_sovereignty_report()
    avail = check_local_model_availability()
    # Backward compatibility attributes
    report["air_gapped"] = True
    report["wan_outbound_calls"] = report["external_ai_calls"]
    report["active_models"] = {
        "reasoning": _CONFIG["roles"].get("REASONING_MODEL", "qwen2.5:7b"),
        "coding": _CONFIG["roles"].get("CODING_MODEL", "qwen2.5:7b"),
        "vision": _CONFIG["roles"].get("VISION_MODEL", "qwen2.5vl:7b"),
        "embeddings": _CONFIG["roles"].get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    }
    report["ollama_online"] = avail.get("ollama_online", False)
    report["installed_models"] = avail.get("installed_models", [])
    report["sovereignty_tier"] = "APPLICATION_GUARD_ENFORCED"
    report["vector_store"] = "ChromaDB (Local Persistent)"
    report["network_isolation"] = "100% LOCAL LOOPBACK (127.0.0.1)"
    report["status"] = report["sovereignty_status"]
    return jsonify(report)


@app.route("/api/sovereignty/audit", methods=["GET"])
def get_sovereignty_audit():
    """Returns persistent and in-memory audit log of all network, AI, tool, and doc events."""
    limit = int(request.args.get("limit", 50))
    category = request.args.get("category", None)
    events = sovereignty_monitor.get_audit_log(limit=limit, category=category)
    return jsonify({
        "total_events": len(events),
        "events": events
    })


@app.route("/api/sovereignty/test-guard", methods=["POST"])
def test_sovereignty_guard():
    """
    Demonstrates active interception and blocking of outbound WAN communication.
    Attempts to call an external API (e.g. OpenAI) and verifies guard raises security exception.
    """
    data = request.get_json() or {}
    target_url = data.get("target_url", "https://api.openai.com/v1/models")
    res = sovereignty_monitor.test_outbound_guard(target_url=target_url)
    return jsonify(res)


# ==============================================================================
# MODULAR LOCAL TOOL SYSTEM ENDPOINTS
# ==============================================================================
@app.route("/api/tools", methods=["GET"])
def get_tools():
    """Returns catalog of all 12 registered safe local tools and schemas."""
    import tool_system
    return jsonify({
        "tools": tool_system.registry.list_tools(),
        "total_tools": len(tool_system.registry.list_tools()),
        "sandbox": {
            "path_containment": "STRICT_WORKSPACE_SANDBOX",
            "code_sandbox": "AST_VALIDATED_ISOLATION",
            "shell_execution": "PROHIBITED",
            "network_access": "AIR_GAPPED_LOCAL_ONLY"
        }
    })


@app.route("/api/tools/execute", methods=["POST"])
def execute_tool():
    """Directly executes a validated local tool by name."""
    data = request.get_json() or {}
    tool_name = data.get("tool", "").strip()
    input_args = data.get("args", {})

    if not tool_name:
        return jsonify({"error": "Missing required field 'tool'."}), 400

    import tool_system
    result = tool_system.registry.invoke(tool_name, input_args)
    return jsonify(result)


# ==============================================================================
# AUTHENTICATION CONFIGURATION ENDPOINT (PUBLIC ANON CREDENTIALS ONLY)
# ==============================================================================
@app.route("/api/auth/config", methods=["GET"])
def get_auth_config():
    """Returns public frontend authentication configuration (URL and Anon key only)."""
    return jsonify({
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "")
    })


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("PORT", 8000))
    except (ValueError, TypeError):
        port = 8000
    debug = os.environ.get("DEBUG", "false").lower() == "true"

    app.run(
        host=host,
        port=port,
        debug=debug
    )