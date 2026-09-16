import chromadb
from sentence_transformers import SentenceTransformer

# Load the same embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Connect to our local database
client = chromadb.PersistentClient(path="./chroma_db")

collection = client.get_collection(
    name="industrial_documents"
)

# Question from the user
question = "What should I check if Machine 101 is overheating?"

# Convert the question into an embedding
query_embedding = embedding_model.encode([question]).tolist()

# Search the local vector database
results = collection.query(
    query_embeddings=query_embedding,
    n_results=3
)

print("\nQUESTION:")
print(question)

print("\nRELEVANT INFORMATION:\n")

for i, document in enumerate(results["documents"][0]):
    print(f"--- Result {i + 1} ---")
    print(document)
