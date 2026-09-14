from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import re
import json

app = Flask(__name__)
CORS(app)


@app.route("/investigate", methods=["POST"])
def investigate():

    data = request.get_json()

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

        process = subprocess.run(
            ["python3", "investigation.py"],
            input=payload + "\n",
            text=True,
            capture_output=True,
            timeout=180
        )

        output = process.stdout



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
            "answer": "The AI investigation took too long to complete."
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


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=True
    )