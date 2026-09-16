"""
Deliverable Generation Package for KAVAAI Sovereign.
====================================================
100% On-premise air-gapped generation and OpenXML/AST verification of:
DOCX, XLSX, PPTX, TXT, CSV, and PY deliverable files.
"""

from backend.documents.deliverable_generator import (
    DeliverableGenerator,
    deliverable_gen
)

__all__ = [
    "DeliverableGenerator",
    "deliverable_gen"
]
