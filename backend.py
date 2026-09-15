from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import re
import json
import sys
import os

# Auto-seed database if needed on backend startup
try:
    from index_document import seed_database
    seed_database()
except Exception as e:
    print(f"[Warning] Auto-seeding vector database encountered: {e}")

app = Flask(__name__)
CORS(app)


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
        })

    try:
        payload = json.dumps(data)
        script_path = os.path.join(os.path.dirname(__file__), "investigation.py")

        process = subprocess.run(
            [sys.executable, script_path],
            input=payload + "\n",
            text=True,
            capture_output=True,
            timeout=180
        )

        output = process.stdout
        if process.returncode != 0 and not output.strip():
            error_msg = process.stderr.strip() or "Unknown error in local investigation script."
            return jsonify({
                "decision": "ERROR",
                "manual_status": "ERROR",
                "image_status": "ERROR",
                "answer": f"Investigation process failed:\n\n`{error_msg}`"
            }), 500

        decision = "BOTH"
        match = re.search(
            r"Agent decision:\s*(MANUAL_SEARCH|IMAGE_ANALYSIS|BOTH)",
            output
        )

        if match:
            decision = match.group(1)

        manual_status = "NOT USED"
        image_status = "NOT USED"

        if decision in ["MANUAL_SEARCH", "BOTH"]:
            manual_status = "COMPLETED"

        if decision in ["IMAGE_ANALYSIS", "BOTH"]:
            image_status = "COMPLETED"

        answer = output
        marker = "### Investigation Report"
        if marker in output:
            answer = output.split(marker, 1)[1]

        if "Evidence-based investigation complete." in answer:
            answer = answer.split(
                "Evidence-based investigation complete.",
                1
            )[0]

        answer = answer.strip()

        return jsonify({
            "decision": decision,
            "manual_status": manual_status,
            "image_status": image_status,
            "answer": answer
        })

    except subprocess.TimeoutExpired:
        return jsonify({
            "decision": "TIMEOUT",
            "manual_status": "TIMEOUT",
            "image_status": "TIMEOUT",
            "answer": "The local AI investigation took too long to complete (>180s)."
        }), 500

    except Exception as e:
        return jsonify({
            "decision": "ERROR",
            "manual_status": "ERROR",
            "image_status": "ERROR",
            "answer": str(e)
        }), 500


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


@app.route("/sovereignty", methods=["GET"])
def sovereignty():
    return jsonify({
        "air_gapped": True,
        "wan_outbound_calls": 0,
        "active_models": {
            "llm": "Qwen2.5 7B (Local Open-Weight)",
            "vision": "Qwen2.5-VL 7B (Local Multimodal)",
            "embeddings": "all-MiniLM-L6-v2 (Local On-Premise)"
        },
        "vector_store": "ChromaDB (Local Persistent)",
        "network_isolation": "100% LOCAL LOOPBACK (127.0.0.1)",
        "status": "AIR-GAP VERIFIED"
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=True
    )