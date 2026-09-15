from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import re
import json

import os

app = Flask(__name__)

# SECURITY: Request size limit (1 MB) to protect against DoS from oversized payloads
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024 

# SECURITY: Configure CORS using environment variable for production safety
origins_str = os.environ.get("CORS_ORIGINS", "http://127.0.0.1:5500 http://localhost:5500")
CORS(app, resources={r"/*": {"origins": origins_str.split()}})

@app.after_request
def add_security_headers(response):
    # SECURITY: Add basic security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response


@app.route("/investigate", methods=["POST"])
def investigate():

    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"decision": "ERROR", "answer": "Invalid JSON format."}), 400
        
        question = data.get("question", "")
        if not isinstance(question, str):
            return jsonify({"decision": "ERROR", "answer": "Invalid question format."}), 400
            
        question = question.strip()
        if not question:
            return jsonify({"decision": "ERROR", "answer": "Please enter a question."}), 400
            
        if len(question) > 500:
            return jsonify({"decision": "ERROR", "answer": "Question is too long."}), 400
            
        telemetry = data.get("telemetry", {})
        if not isinstance(telemetry, dict):
            return jsonify({"decision": "ERROR", "answer": "Invalid telemetry structure."}), 400
            
        # SECURITY: Basic type and bounds checking for telemetry. 
        # These are API security bounds, NOT engineering thresholds.
        for key in ["temperature", "rpm", "pressure", "coolant", "vibration"]:
            if key in telemetry:
                val = telemetry[key]
                if not isinstance(val, (int, float)):
                    return jsonify({"decision": "ERROR", "answer": f"Invalid type for {key}."}), 400
                if val < -10000 or val > 100000:
                    return jsonify({"decision": "ERROR", "answer": f"Value for {key} is out of bounds."}), 400
                    
        fan = telemetry.get("fan")
        if fan is not None and not isinstance(fan, str):
            return jsonify({"decision": "ERROR", "answer": "Invalid type for fan."}), 400
            
    except Exception as e:
        print(f"Validation error: {e}", flush=True)
        return jsonify({"decision": "ERROR", "answer": "Malformed request."}), 400

    try:

        payload = json.dumps(data)

        process = subprocess.run(
            ["python3", "investigation.py"],
            input=payload + "\n",
            text=True,
            capture_output=True,
            timeout=180
        )

        if process.returncode != 0:
            print(f"Investigation script failed! RC: {process.returncode}", flush=True)
            print(f"STDOUT: {process.stdout}", flush=True)
            print(f"STDERR: {process.stderr}", flush=True)
            return jsonify({
                "decision": "ERROR",
                "manual_status": "ERROR",
                "image_status": "ERROR",
                "answer": "AI investigation failed. Please try again."
            }), 500

        output = process.stdout



        decision = "BOTH"

        match = re.search(
            r"Agent decision:\s*(MANUAL_SEARCH|IMAGE_ANALYSIS|BOTH|ERROR)",
            output
        )

        if match:
            decision = match.group(1)

        manual_context_match = re.search(r"### MANUAL_CONTEXT_START ###\n(.*?)\n### MANUAL_CONTEXT_END ###", output, re.DOTALL)
        vision_evidence_match = re.search(r"### VISION_EVIDENCE_START ###\n(.*?)\n### VISION_EVIDENCE_END ###", output, re.DOTALL)

        manual_context = manual_context_match.group(1).strip() if manual_context_match else ""
        vision_evidence = vision_evidence_match.group(1).strip() if vision_evidence_match else ""


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
            "manual_context": manual_context,
            "vision_evidence": vision_evidence,
            "answer": answer
        })

    except subprocess.TimeoutExpired:
        print(f"Subprocess timeout expired for /investigate.", flush=True)

        return jsonify({
            "decision": "TIMEOUT",
            "manual_status": "TIMEOUT",
            "image_status": "TIMEOUT",
            "answer": "The AI investigation took too long to complete."
        }), 500

    except Exception as e:
        print(f"Investigation failed with internal error: {e}", flush=True)
        return jsonify({
            "decision": "ERROR",
            "manual_status": "ERROR",
            "image_status": "ERROR",
            "answer": "An unexpected error occurred during investigation."
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


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=True
    )