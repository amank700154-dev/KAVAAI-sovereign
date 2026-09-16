import os
import sys
import json
from datetime import datetime
from document_intelligence import process_document, chunk_structured_document, SUPPORTED_EXTENSIONS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
KNOWLEDGE_BASE_DIR = os.path.join(BASE_DIR, "knowledge_base")
COLLECTION_NAME = "industrial_documents"

# Ensure root knowledge folders exist
DEFAULT_CATEGORIES = [
    "sops",
    "manuals",
    "maintenance",
    "inspection_reports",
    "engineering",
    "safety",
    "approval_notes",
    "technical_docs"
]

for cat in DEFAULT_CATEGORIES:
    os.makedirs(os.path.join(KNOWLEDGE_BASE_DIR, cat), exist_ok=True)

_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


class KnowledgeConnector:
    """
    Local Organizational Knowledge Connector.
    100% On-premise air-gapped knowledge pipeline:
    File -> Ingestion -> OCR -> Chunking -> Local Embeddings -> Local ChromaDB -> Semantic Retrieval.
    """
    def __init__(self, chroma_path: str = CHROMA_PATH, collection_name: str = COLLECTION_NAME):
        self.chroma_path = chroma_path
        self.collection_name = collection_name

    def _get_collection(self):
        import chromadb
        client = chromadb.PersistentClient(path=self.chroma_path)
        return client.get_or_create_collection(name=self.collection_name)

    def ingest_document(self, file_path: str, category: str = "general", enable_ocr: bool = True) -> dict:
        """
        Ingests a confidential file, performs OCR if scanned, chunks with page citations,
        and saves in the local ChromaDB vector store.
        """
        if not os.path.isabs(file_path):
            file_path = os.path.join(BASE_DIR, file_path)

        if not os.path.exists(file_path):
            return {"status": "FAILED", "error": f"File does not exist: {file_path}"}

        doc = process_document(file_path, enable_ocr=enable_ocr)
        if doc.status in ["FAILED", "CORRUPTED", "EMPTY_DOCUMENT", "UNSUPPORTED"]:
            return {
                "status": "FAILED",
                "filename": doc.filename,
                "error": f"{doc.status}: {'; '.join(doc.processing_errors)}"
            }

        chunks = chunk_structured_document(doc)
        if not chunks:
            return {
                "status": "EMPTY",
                "filename": doc.filename,
                "pages": doc.total_pages,
                "message": "Document contained no extractable text."
            }

        collection = self._get_collection()
        embedder = get_embedder()

        chunk_ids = []
        chunk_docs = []
        chunk_metadatas = []

        for c in chunks:
            chunk_ids.append(c.chunk_id)
            # Prepend human-readable citation to document text for LLM visibility
            formatted_text = f"Source: {c.source}\nPage: {c.page}\nCategory: {category.upper()}\n\n{c.content}"
            chunk_docs.append(formatted_text)
            chunk_metadatas.append({
                "source": c.source,
                "source_filename": c.source,
                "page": int(c.page),
                "category": category.lower(),
                "evidence_type": c.evidence_type,
                "chunk_id": c.chunk_id
            })

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
            "category": category,
            "total_pages": doc.total_pages,
            "chunks_indexed": len(chunks),
            "total_knowledge_chunks": collection.count()
        }

    def sync_knowledge_directory(self, base_folder: str = KNOWLEDGE_BASE_DIR) -> dict:
        """
        Scans all organizational knowledge folders (SOPs, manuals, safety, etc.)
        and indexes new/updated files locally.
        """
        if not os.path.exists(base_folder):
            return {"status": "FAILED", "error": f"Knowledge base directory not found: {base_folder}"}

        stats = {
            "files_processed": 0,
            "chunks_added": 0,
            "details": []
        }

        for root, _, files in os.walk(base_folder):
            # Derive category from folder name
            rel_dir = os.path.relpath(root, base_folder)
            category = "general" if rel_dir == "." else rel_dir.split(os.sep)[0]

            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    fp = os.path.join(root, f)
                    res = self.ingest_document(fp, category=category)
                    stats["files_processed"] += 1
                    if res.get("status") == "SUCCESS":
                        stats["chunks_added"] += res.get("chunks_indexed", 0)
                    stats["details"].append(res)

        return stats

    def search_knowledge_base(self, query: str, top_k: int = 3, category_filter: str = None) -> list:
        """
        SEARCH_KNOWLEDGE_BASE:
        Performs semantic vector retrieval against the local organizational knowledge base.
        Computes similarity score (0.0 to 1.0) and returns clean, sanitized evidence:
        - Source (e.g. Maintenance_Manual.pdf)
        - Page (e.g. 17)
        - Similarity Score (e.g. 89%)
        - Relevant evidence (clean text snippet)
        - Category
        Does NOT expose raw database internals or embeddings.
        """
        import time
        t0 = time.time()
        collection = self._get_collection()
        if collection.count() == 0:
            # Auto-seed with default manual if empty
            from index_document import seed_database
            seed_database()

        embedder = get_embedder()
        query_embedding = embedder.encode([query]).tolist()

        where_clause = None
        if category_filter:
            where_clause = {"category": category_filter.lower()}

        try:
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=top_k,
                where=where_clause,
                include=["documents", "metadatas", "distances"]
            )
        except Exception:
            # Fallback without where clause if filter matches nothing
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=top_k,
                include=["documents", "metadatas", "distances"]
            )

        docs = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []
        distances = results.get("distances", [[]])[0] if results.get("distances") else []

        evidence_list = []

        for i in range(len(docs)):
            raw_text = docs[i]
            meta = metadatas[i] if (i < len(metadatas) and metadatas[i] is not None) else {}
            dist = distances[i] if (i < len(distances) and distances[i] is not None) else 0.5
            
            # Convert cosine distance to normalized similarity percentage (0.0 - 1.0)
            similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
            sim_pct = round(similarity * 100, 1)

            source_file = meta.get("source_filename") or meta.get("source") or "machine_manual.txt"
            page_num = meta.get("page", 1)
            cat = meta.get("category", "DOCUMENT").upper()
            chunk_id = meta.get("chunk_id", f"chunk_{i}")

            # Clean raw text from any prepended source headers for clean presentation
            clean_text = raw_text
            for prefix in [f"Source: {source_file}", f"Page: {page_num}", f"Category: {cat}"]:
                clean_text = clean_text.replace(prefix, "").strip()

            evidence_list.append({
                "source": source_file,
                "page": page_num,
                "category": cat,
                "similarity_score": similarity,
                "similarity_percent": f"{sim_pct}%",
                "chunk_id": chunk_id,
                "relevant_evidence": clean_text.strip(),
                "citation": f"[Source: {source_file} | Page: {page_num} | Match: {sim_pct}%]"
            })

        try:
            from sovereignty_monitor import get_monitor
            dur_ms = round((time.time() - t0) * 1000, 2)
            get_monitor().record_rag_op(
                query=query,
                top_k=top_k,
                chunks_retrieved=len(evidence_list),
                collection=self.collection_name,
                latency_ms=dur_ms
            )
        except Exception:
            pass

        return evidence_list

    def get_sources_catalog(self) -> dict:
        """Returns catalog of indexed organizational documents and categories."""
        collection = self._get_collection()
        total_chunks = collection.count()
        
        # Read unique sources from metadata
        res = collection.get(include=["metadatas"])
        metas = res.get("metadatas", [])
        
        sources = {}
        for m in metas:
            if not m:
                continue
            src = m.get("source_filename") or m.get("source") or "Unknown"
            cat = m.get("category", "general")
            page = m.get("page", 1)
            if src not in sources:
                sources[src] = {"filename": src, "category": cat, "max_page": page, "chunks": 0}
            sources[src]["chunks"] += 1
            if page > sources[src]["max_page"]:
                sources[src]["max_page"] = page

        return {
            "total_documents": len(sources),
            "total_chunks": total_chunks,
            "documents": list(sources.values()),
            "categories": DEFAULT_CATEGORIES
        }


# Global singleton connector instance
connector = KnowledgeConnector()


# ==============================================================================
# CLI / AGENT INTERFACE FUNCTION
# ==============================================================================
def SEARCH_KNOWLEDGE_BASE(query: str, top_k: int = 3, category: str = None) -> list:
    """
    Explicit tool callable by agents:
    SEARCH_KNOWLEDGE_BASE(query, top_k=3, category=None)
    """
    return connector.search_knowledge_base(query, top_k=top_k, category_filter=category)


if __name__ == "__main__":
    print("=" * 65)
    print("LOCAL ORGANIZATIONAL KNOWLEDGE CONNECTOR")
    print("=" * 65)
    cat = connector.get_sources_catalog()
    print(f"Total Knowledge Documents: {cat['total_documents']}")
    print(f"Total Vector Chunks:       {cat['total_chunks']}")
    for d in cat["documents"]:
        print(f" - {d['filename']} [{d['category'].upper()}] ({d['chunks']} chunks, {d['max_page']} pages)")

    q = sys.argv[1] if len(sys.argv) > 1 else "What is the critical temperature limit and overheating procedure?"
    print(f"\nQuerying: '{q}' (top_k=2)")
    results = SEARCH_KNOWLEDGE_BASE(q, top_k=2)
    print("\n--- RETRIEVED EVIDENCE ---")
    for r in results:
        print(f"\nSource: {r['source']}")
        print(f"Page:   {r['page']}")
        print(f"Match:  {r['similarity_percent']}")
        print(f"Relevant evidence:\n{r['relevant_evidence'][:200]}...")
    print("=" * 65)
