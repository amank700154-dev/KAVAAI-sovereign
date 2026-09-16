import requests
import chromadb
from sentence_transformers import SentenceTransformer
import base64



question = input("Enter your question: ")



print("\n[1/4] Asking the agent...")

decision_prompt = f"""
You are an industrial AI decision-making agent.

User question:
{question}

Available tools:

MANUAL_SEARCH
IMAGE_ANALYSIS
BOTH

Rules:

Choose MANUAL_SEARCH for:
- maintenance procedures
- specifications
- temperature limits
- maintenance schedules
- written instructions

Choose IMAGE_ANALYSIS for:
- visible damage
- cracks
- leaks
- blockage
- component appearance

Choose BOTH when the question requires:
- information from the manual AND
- information visible in the image

Important example:

"Is Machine 101 overheating?"
→ BOTH

"What is the critical temperature?"
→ MANUAL_SEARCH

"Is there visible damage?"
→ IMAGE_ANALYSIS

Return ONLY:
MANUAL_SEARCH
IMAGE_ANALYSIS
BOTH
"""

decision_response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen2.5:7b",
        "prompt": decision_prompt,
        "stream": False
    }
)

decision = decision_response.json()["response"].strip()

print("AGENT DECISION:", decision)




manual_context = ""

if "MANUAL_SEARCH" in decision or "BOTH" in decision:

    print("\n[2/4] Searching maintenance manual...")

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

    print("Manual search completed.")



image_analysis = ""

if "IMAGE_ANALYSIS" in decision or "BOTH" in decision:

    print("\n[3/4] Analyzing machine image...")

    image_path = "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png"

    with open(image_path, "rb") as f:
        image_base64 = base64.b64encode(
            f.read()
        ).decode("utf-8")

    image_prompt = f"""
Analyze this industrial machine image.

User question:
{question}

Only describe information that is actually visible
in the image.

Do not guess or invent measurements.
"""

    image_response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "qwen2.5vl:7b",
            "prompt": image_prompt,
            "images": [image_base64],
            "stream": False
        }
    )

    image_analysis = image_response.json()["response"]

    print("Image analysis completed.")




print("\n[4/4] Generating final answer...")

final_prompt = f"""
You are an industrial maintenance assistant.

Answer the user's question using the evidence below.

USER QUESTION:
{question}

MAINTENANCE MANUAL:
{manual_context}

IMAGE ANALYSIS:
{image_analysis}

Rules:

1. Do not invent information.
2. Clearly distinguish visible observations
   from information in the maintenance manual.
3. If the evidence is insufficient, say so.
4. Give a concise and practical answer.

FINAL ANSWER:
"""

final_response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen2.5vl:7b",
        "prompt": final_prompt,
        "stream": False
    }
)

answer = final_response.json()["response"]



print("\n================================")
print("FINAL INDUSTRIAL AI ANSWER")
print("================================")

print(answer)