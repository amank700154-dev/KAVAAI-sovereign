import chromadb
from sentence_transformers import SentenceTransformer


with open("machine_manual.txt", "r", encoding="utf-8") as f:
    text = f.read()

chunks = [
    text[i:i + 500].strip()
    for i in range(0, len(text), 400)
    if text[i:i + 500].strip()
]

print(f"Found {len(chunks)} document chunks.")

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path="./chroma_db")

collection = client.get_or_create_collection(
    name="industrial_documents"
)

embeddings = embedding_model.encode(chunks).tolist()

collection.upsert(
    ids=[f"chunk_{i}" for i in range(len(chunks))],
    documents=chunks,
    embeddings=embeddings
)

print("Document indexed successfully.")
print(f"Stored {collection.count()} chunks in ChromaDB.")
