import requests
import chromadb
from sentence_transformers import SentenceTransformer
import base64
import sys
import json
import os

AI_PROVIDER = os.environ.get("AI_PROVIDER", "LOCAL_OLLAMA")

class AIProviderError(Exception):
    pass

def generate_ai_response(model, prompt, images=None):
    if AI_PROVIDER == "LOCAL_OLLAMA":
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        if images:
            payload["images"] = images
        
        try:
            response = requests.post("http://localhost:11434/api/generate", json=payload)
            response.raise_for_status()
            
            try:
                json_data = response.json()
            except ValueError as e:
                raise AIProviderError(f"Invalid JSON response from local AI: {e}") from e
                
            if "response" not in json_data:
                raise AIProviderError("Malformed JSON response from local AI: 'response' key missing.")
                
            return json_data["response"]
        except requests.exceptions.RequestException as e:
            raise AIProviderError(f"Error connecting to local AI: {e}") from e
    elif AI_PROVIDER == "CLOUD_AI":
        # Cloud AI integration goes here
        raise AIProviderError("Cloud AI provider not yet fully implemented.")
    raise AIProviderError("Unknown AI provider.")


raw_input = sys.stdin.read().strip()
try:
    data = json.loads(raw_input)
    question = data.get("question", raw_input)
    telemetry = data.get("telemetry", {})
except:
    question = raw_input
    telemetry = {}

print("\n[1] Agent is deciding what evidence is needed...")

decision_prompt = f"""
You are an industrial AI decision-making agent.

Question:
{question}

Available tools:
MANUAL_SEARCH
IMAGE_ANALYSIS
BOTH

Rules:

MANUAL_SEARCH:
Use when the answer requires information from the
maintenance manual, specifications, limits, schedules,
or procedures.

IMAGE_ANALYSIS:
Use when the answer requires examining visible
physical conditions.

BOTH:
Use when the answer requires BOTH the manual and
visual evidence.

Examples:

What is the critical temperature?
MANUAL_SEARCH

Is there visible damage to the machine?
IMAGE_ANALYSIS

Is Machine 101 overheating?
BOTH

Return ONLY:
MANUAL_SEARCH
IMAGE_ANALYSIS
or
BOTH
"""

try:
    decision = generate_ai_response("qwen2.5:7b", decision_prompt).strip()
except AIProviderError as e:
    print("Agent decision: ERROR")
    print("\n------------------------------------------")
    print(f"**INVESTIGATION FAILED**\n\nAI Error:\n`{str(e)}`")
    print("\n==========================================")
    print("Evidence-based investigation complete.")
    print("==========================================")
    sys.exit(1)

print("Agent decision:", decision)




manual_context = ""

if "MANUAL_SEARCH" in decision or "BOTH" in decision:

    print("\n[2] Searching maintenance documents...")

    embedding_model = SentenceTransformer(
        "all-MiniLM-L6-v2"
    )

    client = chromadb.PersistentClient(
        path="./chroma_db"
    )

    collection = client.get_collection(
        name="industrial_documents"
    )

    query_embedding = embedding_model.encode(
        [question]
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=2
    )

    manual_context = "\n\n".join(
        results["documents"][0]
    )

    print("✓ Manual evidence retrieved.")



image_analysis = ""

if "IMAGE_ANALYSIS" in decision or "BOTH" in decision:

    print("\n[3] Analyzing machine image...")

    image_path = "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png"
    
    try:
        with open(image_path, "rb") as f:
            image_base64 = base64.b64encode(
                f.read()
            ).decode("utf-8")
    except Exception as e:
        image_analysis = f"Error reading machine image file: {e}"
        print("✗ Image read failed.")
    
    if "image_analysis" not in locals():
        image_prompt = f"""
Analyze the industrial machine image.

Question:
{question}

Only report information that can actually be
observed in the image.

Do not guess measurements.
Do not assume something is visible if it is not.
"""
        try:
            image_analysis = generate_ai_response("qwen2.5vl:7b", image_prompt, [image_base64])
            print("✓ Image evidence retrieved.")
        except AIProviderError as e:
            print("\n------------------------------------------")
            print(f"**INVESTIGATION FAILED**\n\nAI Error:\n`{str(e)}`")
            print("\n==========================================")
            print("Evidence-based investigation complete.")
            print("==========================================")
            sys.exit(1)



print("\n[4] Creating evidence-based assessment...")

final_prompt = f"""
You are an industrial maintenance AI assistant.

Investigate the user's question using the evidence
provided below. Identify possible root causes from the evidence actually available.

USER QUESTION:
{question}

========================
TELEMETRY EVIDENCE
========================
Temperature: {telemetry.get('temperature', 'N/A')}°C
RPM: {telemetry.get('rpm', 'N/A')}
Pressure: {telemetry.get('pressure', 'N/A')} bar
Coolant: {telemetry.get('coolant', 'N/A')}%
Vibration: {telemetry.get('vibration', 'N/A')}
Fan: {telemetry.get('fan', 'N/A')}

========================
MANUAL EVIDENCE
========================
{manual_context}

========================
IMAGE EVIDENCE
========================
{image_analysis}

========================
INSTRUCTIONS
========================

Produce an investigation report with exactly
these sections:

#### ANOMALY
Explain the actual abnormal telemetry based on the question and provided data.

#### ROOT CAUSE CANDIDATES
For each candidate format exactly as:
**Cause:** [Name of the cause]
**Evidence:** [What evidence supports this, if any]
**Source:** TELEMETRY / MANUAL / VISION
**Support level:** SUPPORTED / POSSIBLE / POSSIBLE CAUSE — NO DIRECT EVIDENCE

#### EVIDENCE

**Telemetry Evidence**
[List telemetry facts]

**Manual Evidence**
[List manual facts, or NOT USED]

**Vision Evidence**
[List vision facts, or NOT USED]

#### ASSESSMENT
Clearly state:
- What is established by evidence.
- Which candidate has the strongest available support.
- Which causes remain possible but unconfirmed.
- What additional inspection would be needed to establish the root cause.
If no cause is sufficiently supported, explicitly say:
"Root cause cannot be established from the available evidence."
Do NOT invent a winner just to make the answer sound confident.

#### RECOMMENDED ACTION
Give actions that directly address the observed anomaly and help distinguish between the possible causes. Use the actual maintenance manual evidence whenever available. Do not invent thresholds, probabilities, maintenance intervals, failure rates, or operating limits.

IMPORTANT REASONING RULES:
1. TELEMETRY FACT: Directly state measured telemetry (e.g., "Temperature: 85°C"). These are observations, not automatically root causes.
2. DOCUMENT-SUPPORTED CLAIM: A maintenance threshold or recommended operating range may ONLY be stated if it actually exists in the retrieved manual evidence. Do not invent ranges (e.g., "70% to 80%").
3. ROOT CAUSE: Do NOT force the AI to select a root cause when the evidence does not support one.
4. POSSIBLE CAUSE: If something is a common possible cause but there is no direct evidence, label its support level as "POSSIBLE CAUSE — NO DIRECT EVIDENCE".
5. VISION: If vision says the fan is active, do NOT automatically infer that the fan is defective. Report that it is active but performance is unconfirmed. Do not infer Dust is present without vision/manual evidence. Do not infer Coolant is insufficient merely because the number looks low. Do not infer Sensor is faulty without supporting evidence.
6. The goal is to make the investigation auditable: OBSERVATION -> EVIDENCE -> SUPPORT LEVEL -> ASSESSMENT -> ACTION.
"""

try:
    report = generate_ai_response("qwen2.5vl:7b", final_prompt)
except AIProviderError as e:
    report = f"**INVESTIGATION FAILED**\n\nAI Error:\n`{str(e)}`"



print("\n")
print("==========================================")
print("      INDUSTRIAL AI INVESTIGATION")
print("==========================================")

print("\nQuestion:")
print(question)

print("\nAgent tools used:")
print(decision)

print("\n------------------------------------------")
print(report)

print("\n==========================================")
print("Evidence-based investigation complete.")
print("==========================================")
