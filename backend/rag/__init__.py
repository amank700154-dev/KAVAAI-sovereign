"""
Local Organizational Knowledge Base & RAG Package for KAVAAI Sovereign.
========================================================================
Confidential document ingestion, chunking, local embeddings, and vector retrieval.
"""

from backend.rag.knowledge_connector import (
    KnowledgeConnector,
    SEARCH_KNOWLEDGE_BASE
)
from backend.rag.indexer import (
    index_document_file,
    seed_database
)

__all__ = [
    "KnowledgeConnector",
    "SEARCH_KNOWLEDGE_BASE",
    "index_document_file",
    "seed_database"
]
