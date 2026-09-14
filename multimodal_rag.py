import chromadb
from sentence_transformers import SentenceTransformer
import requests
import base64



embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path="./chroma_db")

collection = client.get_collection(
    name="industrial_documents"
)



question = input("Enter your question: ")



query_embedding = embedding_model.encode([question]).tolist()

results = collection.query(
    query_embeddings=query_embedding,
    n_results=2
)

context = "\n\n".join(results["documents"][0])



image_path = "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png"

with open(image_path, "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode("utf-8")



prompt = f"""
You are an industrial maintenance assistant.

Investigate the user's question using BOTH:
1. The machine manual information.
2. The visible information in the machine image.

Do not invent information.

If something cannot be determined from the manual or image,
clearly say that it cannot be determined.

MANUAL INFORMATION:
{context}

USER QUESTION:
{question}

Give a concise, evidence-based answer.
"""

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen2.5vl:7b",
        "prompt": prompt,
        "images": [image_base64],
        "stream": False
    }
)

data = response.json()

print("\nQUESTION:")
print(question)

print("\nAI INVESTIGATION:")
print(data["response"])
