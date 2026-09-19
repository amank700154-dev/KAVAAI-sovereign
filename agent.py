import requests

question = input("Enter your question: ")

prompt = f"""
You are an industrial AI decision-making agent.

User question:
{question}

Available tools:

1. MANUAL_SEARCH
   Search the industrial maintenance manual.

2. IMAGE_ANALYSIS
   Inspect the machine image.

3. BOTH
   Use both the maintenance manual and the machine image.

Rules:

- Choose MANUAL_SEARCH if the answer can be obtained from the
  maintenance manual, specifications, temperature limits,
  maintenance schedules, or written procedures.

- Choose IMAGE_ANALYSIS if the question only requires examining
  something physically visible in the machine image, such as
  visible damage, cracks, blockage, leaks, or component appearance.

- Choose BOTH if the question requires comparing what is visible
  in the image with information from the maintenance manual.

Important examples:

"What is the critical temperature?"
→ MANUAL_SEARCH

"Is there visible damage to the cooling fan?"
→ IMAGE_ANALYSIS

"Is Machine 101 overheating?"
→ BOTH

"What should I do if the temperature exceeds 80°C?"
→ MANUAL_SEARCH

"Does the machine have a visible coolant leak?"
→ IMAGE_ANALYSIS

Return ONLY one of these three values:

MANUAL_SEARCH
IMAGE_ANALYSIS
BOTH
"""

import os
import requests

OLLAMA_HOST = (os.environ.get("OLLAMA_BASE_URL") or os.environ.get("OLLAMA_HOST", "http://localhost:11434")).rstrip("/")
MODEL_NAME = os.environ.get("OLLAMA_MODEL") or os.environ.get("KAVAAI_REASONING_MODEL", "qwen2.5:7b")

generate_url = f"{OLLAMA_HOST}/api/generate"

print(f"\n[LOCAL_AI]\nprovider=ollama\nmodel={MODEL_NAME}\nendpoint={OLLAMA_HOST.split('://')[-1]}\nnetwork_scope=LOCAL\n")

try:
    response = requests.post(
        generate_url,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False
        },
        timeout=60
    )
    if response.status_code == 200:
        decision = response.json().get("response", "").strip()
        print("\nAGENT DECISION:")
        print(decision)
    else:
        print(f"\nLOCAL AI UNAVAILABLE\nOllama returned HTTP {response.status_code}: {response.text}\nNo external/cloud model fallback is permitted.")
except Exception as e:
    print(f"\nLOCAL AI UNAVAILABLE\nOllama server could not be reached at {OLLAMA_HOST}: {e}\nNo external/cloud model fallback is permitted.")

