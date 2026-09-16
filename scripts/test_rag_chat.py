import chromadb
from sentence_transformers import SentenceTransformer
import requests

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

prompt = f"""
You are an industrial maintenance assistant.

Answer the user's question using ONLY the information provided
in the context below.

If the context does not contain the answer, say:
"I don't have enough information in the provided documents."

Context:
{context}

Question:
{question}

Answer clearly and briefly.
"""

# Send request to local Qwen through Ollama
response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen2.5:7b",
        "prompt": prompt,
        "stream": False
    }
)

# Display answer
print("\nQUESTION:")
print(question)

print("\nAI ANSWER:")
print(response.json()["response"])
