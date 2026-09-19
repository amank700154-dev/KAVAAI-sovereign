import os
import sys
import chromadb
from sentence_transformers import SentenceTransformer
from document_intelligence import (
    process_document,
    chunk_structured_document,
    SUPPORTED_EXTENSIONS
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MANUAL_PATH = os.environ.get("KAVAAI_MANUAL_PATH", os.path.join(BASE_DIR, "machine_manual.txt"))
DEFAULT_CHROMA_PATH = os.environ.get("KAVAAI_CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db"))

_cached_embedder = None

def get_embedder():
    global _cached_embedder
    if _cached_embedder is None:
        _cached_embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _cached_embedder


def index_document_file(
    file_path: str,
    chroma_path: str = DEFAULT_CHROMA_PATH,
    collection_name: str = "industrial_documents",
    enable_ocr: bool = True,
    enable_vision: bool = True
) -> dict:
    """
    Ingests and indexes an on-premise industrial document (PDF, scanned PDF, image, DOCX, TXT).
    Extracts text, executes local OCR if scanned, chunks with page-level citations,
    and stores in ChromaDB.
    """
    if not os.path.exists(file_path):
        return {"status": "FAILED", "error": f"File does not exist: {file_path}"}

    # 1. Process document through intelligence layer
    doc = process_document(file_path, enable_ocr=enable_ocr, enable_vision=enable_vision)
    if doc.status in ["FAILED", "CORRUPTED", "EMPTY_DOCUMENT", "UNSUPPORTED"]:
        return {
            "status": "FAILED",
            "filename": doc.filename,
            "error_type": doc.status,
            "errors": doc.processing_errors
        }

    # 2. Chunk with page & evidence metadata
    chunks = chunk_structured_document(doc)
    if not chunks:
        return {
            "status": "EMPTY",
            "filename": doc.filename,
            "message": "Document parsed but contained no extractable text chunks.",
            "pages": doc.total_pages,
            "errors": doc.processing_errors
        }

    # 3. Embed and store in ChromaDB
    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_or_create_collection(name=collection_name)

    chunk_ids = []
    chunk_docs = []
    chunk_metadatas = []

    for c in chunks:
        chunk_ids.append(c.chunk_id)
        # Store citation directly in document text for robust semantic retrieval and evidence formatting
        chunk_docs.append(f"{c.get_citation()}\n{c.content}")
        chunk_metadatas.append({
            "source": c.source,
            "page": int(c.page),
            "evidence_type": c.evidence_type,
            "citation": c.get_citation()
        })

    embedder = get_embedder()
    embeddings = embedder.encode(chunk_docs).tolist()

    collection.upsert(
        ids=chunk_ids,
        documents=chunk_docs,
        embeddings=embeddings,
        metadatas=chunk_metadatas
    )

    return {
        "status": "SUCCESS",
        "filename": doc.filename,
        "file_type": doc.file_type,
        "pages": doc.total_pages,
        "chunks_indexed": len(chunks),
        "total_collection_chunks": collection.count(),
        "errors": doc.processing_errors
    }


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

    print(f"Indexing industrial documentation: {manual_path}...")
    res = index_document_file(
        manual_path,
        chroma_path=chroma_path,
        collection_name="industrial_documents",
        enable_ocr=False
    )

    if res.get("status") == "SUCCESS":
        print(f"Document indexed successfully. Stored {res['chunks_indexed']} chunks in ChromaDB.")
        return res["total_collection_chunks"]
    else:
        print(f"Failed to seed database: {res.get('errors')}")
        return current_count


def index_directory(dir_path: str, chroma_path: str = DEFAULT_CHROMA_PATH) -> list:
    """
    Indexes all supported documents in a target folder.
    """
    if not os.path.exists(dir_path):
        return []

    results = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_p = os.path.join(root, f)
                res = index_document_file(full_p, chroma_path=chroma_path)
                results.append(res)
    return results


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MANUAL_PATH
    if os.path.isdir(target):
        print(f"Indexing directory: {target}")
        res_list = index_directory(target)
        print(f"Processed {len(res_list)} documents.")
    else:
        print(f"Indexing single document: {target}")
        res = index_document_file(target)
        print(res)
