"""
Multimodal Document Intelligence Package for KAVAAI Sovereign.
==============================================================
PDF inspection, local OCR extraction, and multimodal vision analysis.
"""

from backend.multimodal.document_intelligence import (
    DocumentPage,
    ProcessedDocument,
    inspect_document,
    process_document,
    extract_text_via_ocr,
    analyze_page_images_multimodal,
    chunk_structured_document,
    SUPPORTED_EXTENSIONS
)

__all__ = [
    "DocumentPage",
    "ProcessedDocument",
    "inspect_document",
    "process_document",
    "extract_text_via_ocr",
    "analyze_page_images_multimodal",
    "chunk_structured_document",
    "SUPPORTED_EXTENSIONS"
]
