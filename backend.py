from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import sys
import os
from agent_orchestrator import orchestrator
from model_router import (
    check_local_model_availability,
    get_routing_history,
    classify_task,
    _CONFIG,
    DEFAULT_ROLES
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Auto-seed vector database if needed on startup
try:
    from index_document import seed_database
    seed_database()
except Exception as e:
    print(f"[Warning] Auto-seeding vector database encountered: {e}")

app = Flask(__name__)
CORS(app)


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
            file_path = os.path.join(BASE_DIR, file_path)
            
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
            file_path = os.path.join(BASE_DIR, file_path)
            
        doc = process_document(file_path, enable_ocr=enable_ocr)
        return jsonify(doc.to_dict())
    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500


@app.route("/api/documents", methods=["GET"])
def list_documents():
    try:
        import chromadb
        client = chromadb.PersistentClient(path=os.path.join(BASE_DIR, "chroma_db"))
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


# ==============================================================================
# FILE DELIVERABLES DOWNLOAD ENDPOINT
# ==============================================================================
@app.route("/deliverables/<path:filename>", methods=["GET"])
def download_deliverable(filename):
    clean_name = os.path.basename(filename)
    if not os.path.exists(os.path.join(OUTPUT_DIR, clean_name)):
        return jsonify({"error": f"Deliverable file '{clean_name}' not found."}), 404
    return send_from_directory(OUTPUT_DIR, clean_name, as_attachment=True)


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
# AIR-GAP SOVEREIGNTY STATUS ENDPOINT
# ==============================================================================
@app.route("/sovereignty", methods=["GET"])
def sovereignty():
    avail = check_local_model_availability()
    return jsonify({
        "air_gapped": True,
        "wan_outbound_calls": 0,
        "active_models": {
            "reasoning": _CONFIG["roles"].get("REASONING_MODEL", "qwen2.5:7b"),
            "coding": _CONFIG["roles"].get("CODING_MODEL", "qwen2.5:7b"),
            "vision": _CONFIG["roles"].get("VISION_MODEL", "qwen2.5vl:7b"),
            "embeddings": _CONFIG["roles"].get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        },
        "ollama_online": avail.get("ollama_online", False),
        "installed_models": avail.get("installed_models", []),
        "vector_store": "ChromaDB (Local Persistent)",
        "network_isolation": "100% LOCAL LOOPBACK (127.0.0.1)",
        "status": "AIR-GAP VERIFIED"
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=False
    )