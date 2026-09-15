import os
import chromadb
from sentence_transformers import SentenceTransformer

DEFAULT_MANUAL_PATH = os.path.join(os.path.dirname(__file__), "machine_manual.txt")
DEFAULT_CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

def seed_database(manual_path=DEFAULT_MANUAL_PATH, chroma_path=DEFAULT_CHROMA_PATH, force=False):
    """
    Initializes and seeds the ChromaDB vector database with the industrial manual.
    If the collection already contains chunks and force=False, skips re-indexing.
    """
    if not os.path.exists(manual_path):
        print(f"[Warning] Manual file not found at: {manual_path}")
        return 0

    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_or_create_collection(name="industrial_documents")

    current_count = collection.count()
    if current_count > 0 and not force:
        print(f"ChromaDB already initialized with {current_count} document chunks.")
        return current_count

    with open(manual_path, "r", encoding="utf-8") as f:
        text = f.read()

    chunks = [
        text[i:i + 500].strip()
        for i in range(0, len(text), 400)
        if text[i:i + 500].strip()
    ]

    print(f"Found {len(chunks)} document chunks. Encoding with all-MiniLM-L6-v2...")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = embedding_model.encode(chunks).tolist()

    collection.upsert(
        ids=[f"chunk_{i}" for i in range(len(chunks))],
        documents=chunks,
        embeddings=embeddings
    )

    total_chunks = collection.count()
    print(f"Document indexed successfully. Stored {total_chunks} chunks in ChromaDB.")
    return total_chunks

if __name__ == "__main__":
    seed_database(force=True)

