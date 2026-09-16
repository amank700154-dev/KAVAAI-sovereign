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

try:
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False
        },
        timeout=30
    )
    decision = response.json()["response"].strip()
    print("\nAGENT DECISION:")
    print(decision)
except Exception as e:
    print(f"\nError communicating with local AI engine: {e}")

