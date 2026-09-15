import os
import sys
import io
import json
import base64
from datetime import datetime
from PIL import Image
import pypdf
from model_router import invoke_local_model, _CONFIG

# Supported file extensions
SUPPORTED_EXTENSIONS = {
    ".pdf": "PDF",
    ".png": "IMAGE",
    ".jpg": "IMAGE",
    ".jpeg": "IMAGE",
    ".bmp": "IMAGE",
    ".webp": "IMAGE",
    ".tiff": "IMAGE",
    ".txt": "TEXT",
    ".md": "TEXT",
    ".log": "TEXT",
    ".json": "DATA",
    ".csv": "DATA",
    ".docx": "DOCX"
}

MAX_SAFE_PDF_PAGES = 100
MAX_SAFE_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class DocumentPage:
    """Represents a single page or single visual section of a document."""
    def __init__(self, page_num: int):
        self.page_num = page_num
        self.digital_text = ""
        self.ocr_text = ""
        self.ocr_status = "NOT_NEEDED"  # "NOT_NEEDED" | "SUCCESS" | "FAILED" | "OFFLINE"
        self.ocr_error = None
        self.vision_analysis = ""
        self.has_digital_text = False
        self.has_images = False
        self.image_count = 0
        self.extracted_images = []  # list of dicts with image metadata and base64
        self.classification = "UNKNOWN"  # "DIGITAL_TEXT" | "SCANNED_IMAGE" | "MIXED" | "EMPTY"

    def get_combined_text(self) -> str:
        parts = []
        if self.digital_text.strip():
            parts.append(self.digital_text.strip())
        if self.ocr_status == "SUCCESS" and self.ocr_text.strip():
            parts.append(f"[OCR Extracted]:\n{self.ocr_text.strip()}")
        if self.vision_analysis.strip():
            parts.append(f"[Visual Description]:\n{self.vision_analysis.strip()}")
        return "\n\n".join(parts)

    def to_dict(self) -> dict:
        return {
            "page_num": self.page_num,
            "classification": self.classification,
            "has_digital_text": self.has_digital_text,
            "digital_text_len": len(self.digital_text),
            "has_images": self.has_images,
            "image_count": self.image_count,
            "ocr_status": self.ocr_status,
            "ocr_error": self.ocr_error,
            "ocr_text_len": len(self.ocr_text),
            "has_vision_analysis": bool(self.vision_analysis)
        }


class StructuredDocument:
    """Unified, sovereign structured representation of an industrial document."""
    def __init__(self, file_path: str):
        self.file_path = os.path.abspath(file_path)
        self.filename = os.path.basename(file_path)
        self.file_size = 0
        self.file_type = "UNKNOWN"
        self.total_pages = 0
        self.pages = []  # list of DocumentPage
        self.status = "INITIALIZED"  # "SUCCESS" | "PARTIAL" | "FAILED" | "EMPTY" | "CORRUPTED"
        self.processing_errors = []
        self.is_large_document = False
        self.metadata = {}
        self.created_at = datetime.now().isoformat()

    def add_page(self, page: DocumentPage):
        self.pages.append(page)
        self.total_pages = len(self.pages)

    def get_full_text(self) -> str:
        return "\n\n--- Page Break ---\n\n".join(
            f"--- Page {p.page_num} [{p.classification}] ---\n" + p.get_combined_text()
            for p in self.pages
            if p.get_combined_text().strip()
        )

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "file_size_bytes": self.file_size,
            "total_pages": self.total_pages,
            "status": self.status,
            "is_large_document": self.is_large_document,
            "processing_errors": self.processing_errors,
            "pages": [p.to_dict() for p in self.pages],
            "created_at": self.created_at
        }


class DocumentChunk:
    """Indexed chunk with full source and page citation traceability."""
    def __init__(self, chunk_id: str, source: str, page: int, content: str, evidence_type: str):
        self.chunk_id = chunk_id
        self.source = source
        self.page = page
        self.content = content
        self.evidence_type = evidence_type  # "DIGITAL_TEXT" | "OCR_TRANSCRIPT" | "VISION_ANALYSIS"

    def get_citation(self) -> str:
        return f"[Document: {self.source} | Page: {self.page} | Evidence: {self.evidence_type}]"

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "source": self.source,
            "page": self.page,
            "evidence_type": self.evidence_type,
            "citation": self.get_citation(),
            "content": self.content
        }


# ==============================================================================
# PIPELINE STEP 1: FILE TYPE & CAPABILITY DETECTION
# ==============================================================================
def detect_file_capability(file_path: str) -> dict:
    """
    Validates file existence, bounds, and classifies file type and required pipeline capabilities.
    """
    if not os.path.exists(file_path):
        return {
            "valid": False,
            "error": f"File does not exist: {file_path}",
            "error_code": "FILE_NOT_FOUND"
        }

    size = os.path.getsize(file_path)
    if size == 0:
        return {
            "valid": False,
            "error": f"Document is completely empty (0 bytes): {os.path.basename(file_path)}",
            "error_code": "EMPTY_DOCUMENT"
        }

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return {
            "valid": False,
            "error": f"Unsupported file type '{ext}'. Supported: {list(SUPPORTED_EXTENSIONS.keys())}",
            "error_code": "UNSUPPORTED_FILE_TYPE"
        }

    category = SUPPORTED_EXTENSIONS[ext]
    is_large = size > MAX_SAFE_FILE_SIZE

    return {
        "valid": True,
        "extension": ext,
        "category": category,
        "size_bytes": size,
        "is_large": is_large
    }


# ==============================================================================
# LOCAL OCR & VISION INFERENCE HELPER
# ==============================================================================
def run_local_ocr_on_image(image_base64: str) -> dict:
    """
    Invokes the local multimodal vision model (qwen2.5vl:7b) to transcribe
    scanned documents or handwritten text without any WAN egress.
    Never fakes success if the engine is offline.
    """
    vision_model = _CONFIG["roles"].get("VISION_MODEL", "qwen2.5vl:7b")
    prompt = (
        "Transcribe all text, numbers, labels, tables, and handwritten notes in this document. "
        "Do not invent information. Format clearly with exact words and values."
    )

    res = invoke_local_model(vision_model, prompt=prompt, images=[image_base64], timeout=90)
    if res.get("success"):
        return {
            "status": "SUCCESS",
            "text": res.get("response", "").strip(),
            "model_used": res.get("model_used")
        }
    else:
        # Report honest failure
        err_msg = res.get("error", "Local OCR engine failed.")
        return {
            "status": "FAILED",
            "error": err_msg,
            "simulated": res.get("simulated", False)
        }


def run_local_vision_analysis(image_base64: str, context_prompt: str = "") -> dict:
    """
    Analyzes industrial engineering drawings, schematics, component photos, or crack patterns.
    """
    vision_model = _CONFIG["roles"].get("VISION_MODEL", "qwen2.5vl:7b")
    prompt = context_prompt or (
        "Inspect this industrial drawing or engineering component. "
        "Identify component IDs, dimensions, visible defects, piping connections, or warning tags."
    )

    res = invoke_local_model(vision_model, prompt=prompt, images=[image_base64], timeout=90)
    if res.get("success"):
        return {
            "status": "SUCCESS",
            "description": res.get("response", "").strip(),
            "model_used": res.get("model_used")
        }
    else:
        return {
            "status": "FAILED",
            "error": res.get("error", "Local vision analysis failed.")
        }


# ==============================================================================
# PIPELINE STEP 2 & 3: PDF EXTRACTION & OCR ROUTING
# ==============================================================================
def process_pdf_document(file_path: str, enable_ocr: bool = True) -> StructuredDocument:
    doc = StructuredDocument(file_path)
    doc.file_type = "PDF"
    doc.file_size = os.path.getsize(file_path)

    try:
        reader = pypdf.PdfReader(file_path)
    except Exception as e:
        doc.status = "CORRUPTED"
        doc.processing_errors.append(f"Corrupted PDF file cannot be parsed: {str(e)}")
        return doc

    num_pages = len(reader.pages)
    if num_pages == 0:
        doc.status = "EMPTY"
        doc.processing_errors.append("PDF contains 0 pages.")
        return doc

    if num_pages > MAX_SAFE_PDF_PAGES:
        doc.is_large_document = True
        doc.processing_errors.append(f"Document has {num_pages} pages; processing first {MAX_SAFE_PDF_PAGES} to safeguard on-premise resources.")
        num_pages = MAX_SAFE_PDF_PAGES

    for page_idx in range(num_pages):
        page_num = page_idx + 1
        page_obj = reader.pages[page_idx]
        doc_page = DocumentPage(page_num)

        # 1. Text extraction
        try:
            raw_text = page_obj.extract_text() or ""
            doc_page.digital_text = raw_text.strip()
            doc_page.has_digital_text = len(doc_page.digital_text) >= 30
        except Exception as e:
            doc.processing_errors.append(f"Page {page_num}: text extraction error: {e}")

        # 2. Page image extraction
        try:
            if hasattr(page_obj, "images"):
                for img_obj in page_obj.images:
                    img_bytes = img_obj.data
                    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                    doc_page.extracted_images.append({
                        "name": img_obj.name,
                        "size_bytes": len(img_bytes),
                        "base64": img_b64
                    })
                doc_page.image_count = len(doc_page.extracted_images)
                doc_page.has_images = doc_page.image_count > 0
        except Exception as e:
            doc.processing_errors.append(f"Page {page_num}: image extraction error: {e}")

        # 3. Capability detection & classification
        if doc_page.has_digital_text and doc_page.has_images:
            doc_page.classification = "MIXED"
        elif doc_page.has_digital_text:
            doc_page.classification = "DIGITAL_TEXT"
        elif doc_page.has_images:
            doc_page.classification = "SCANNED_IMAGE"
        else:
            doc_page.classification = "EMPTY"

        # 4. Trigger OCR if page is scanned or mixed and digital text is absent
        if doc_page.classification in ["SCANNED_IMAGE", "MIXED"] and enable_ocr and doc_page.has_images:
            primary_img = doc_page.extracted_images[0]["base64"]
            ocr_res = run_local_ocr_on_image(primary_img)
            if ocr_res["status"] == "SUCCESS":
                doc_page.ocr_status = "SUCCESS"
                doc_page.ocr_text = ocr_res["text"]
            else:
                doc_page.ocr_status = "FAILED"
                doc_page.ocr_error = ocr_res.get("error")

        doc.add_page(doc_page)

    doc.status = "SUCCESS" if doc.total_pages > 0 else "EMPTY"
    return doc


# ==============================================================================
# IMAGE DOCUMENT HANDLER (JPG, PNG, ENGINEERING DRAWINGS)
# ==============================================================================
def process_image_document(file_path: str, enable_ocr: bool = True, enable_vision: bool = True) -> StructuredDocument:
    doc = StructuredDocument(file_path)
    doc.file_type = "IMAGE"
    doc.file_size = os.path.getsize(file_path)

    try:
        with Image.open(file_path) as img:
            width, height = img.size
            fmt = img.format
    except Exception as e:
        doc.status = "CORRUPTED"
        doc.processing_errors.append(f"Corrupted or invalid image: {e}")
        return doc

    try:
        with open(file_path, "rb") as f:
            img_bytes = f.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
    except Exception as e:
        doc.status = "FAILED"
        doc.processing_errors.append(f"Failed reading image bytes: {e}")
        return doc

    doc_page = DocumentPage(page_num=1)
    doc_page.has_images = True
    doc_page.image_count = 1
    doc_page.classification = "ENGINEERING_DRAWING_OR_IMAGE"
    doc_page.extracted_images.append({
        "name": doc.filename,
        "dimensions": f"{width}x{height}",
        "format": fmt,
        "base64": img_b64
    })

    # OCR extraction for handwritten notes, labels, or schematics
    if enable_ocr:
        ocr_res = run_local_ocr_on_image(img_b64)
        if ocr_res["status"] == "SUCCESS":
            doc_page.ocr_status = "SUCCESS"
            doc_page.ocr_text = ocr_res["text"]
        else:
            doc_page.ocr_status = "FAILED"
            doc_page.ocr_error = ocr_res.get("error")

    # Vision description for physical component state
    if enable_vision:
        v_res = run_local_vision_analysis(img_b64)
        if v_res["status"] == "SUCCESS":
            doc_page.vision_analysis = v_res["description"]
        else:
            # Sovereign offline note
            doc_page.vision_analysis = f"Equipment image '{doc.filename}' ({width}x{height}) captured for local inspection."

    doc.add_page(doc_page)
    doc.status = "SUCCESS"
    return doc


# ==============================================================================
# TEXT & WORD DOCUMENT HANDLERS
# ==============================================================================
def process_text_document(file_path: str) -> StructuredDocument:
    doc = StructuredDocument(file_path)
    doc.file_type = "TEXT"
    doc.file_size = os.path.getsize(file_path)

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        doc.status = "FAILED"
        doc.processing_errors.append(f"Could not read text file: {e}")
        return doc

    if not content.strip():
        doc.status = "EMPTY"
        doc.processing_errors.append("Text file contains no characters.")
        return doc

    doc_page = DocumentPage(page_num=1)
    doc_page.digital_text = content
    doc_page.has_digital_text = True
    doc_page.classification = "DIGITAL_TEXT"
    doc.add_page(doc_page)
    doc.status = "SUCCESS"
    return doc


def process_docx_document(file_path: str) -> StructuredDocument:
    import docx
    doc = StructuredDocument(file_path)
    doc.file_type = "DOCX"
    doc.file_size = os.path.getsize(file_path)

    try:
        word_doc = docx.Document(file_path)
        paragraphs = [p.text for p in word_doc.paragraphs if p.text.strip()]
        full_text = "\n\n".join(paragraphs)
    except Exception as e:
        doc.status = "CORRUPTED"
        doc.processing_errors.append(f"Could not read DOCX document: {e}")
        return doc

    if not full_text.strip():
        doc.status = "EMPTY"
        doc.processing_errors.append("Word document contains no readable paragraphs.")
        return doc

    doc_page = DocumentPage(page_num=1)
    doc_page.digital_text = full_text
    doc_page.has_digital_text = True
    doc_page.classification = "DIGITAL_TEXT"
    doc.add_page(doc_page)
    doc.status = "SUCCESS"
    return doc


# ==============================================================================
# MAIN DISPATCHER: PROCESS ANY CONFIDENTIAL DOCUMENT
# ==============================================================================
def process_document(file_path: str, enable_ocr: bool = True, enable_vision: bool = True) -> StructuredDocument:
    """
    Main entry point for confidential on-premise document processing.
    Directs to specialized extractors with capability detection and error handling.
    """
    check = detect_file_capability(file_path)
    if not check["valid"]:
        doc = StructuredDocument(file_path)
        doc.status = check["error_code"]
        doc.processing_errors.append(check["error"])
        return doc

    category = check["category"]
    if category == "PDF":
        return process_pdf_document(file_path, enable_ocr=enable_ocr)
    elif category == "IMAGE":
        return process_image_document(file_path, enable_ocr=enable_ocr, enable_vision=enable_vision)
    elif category == "DOCX":
        return process_docx_document(file_path)
    elif category in ["TEXT", "DATA"]:
        return process_text_document(file_path)
    else:
        doc = StructuredDocument(file_path)
        doc.status = "UNSUPPORTED"
        doc.processing_errors.append(f"Unrecognized file category: {category}")
        return doc


# ==============================================================================
# CHUNKER WITH FULL PAGE CITATION METADATA
# ==============================================================================
def chunk_structured_document(doc: StructuredDocument, chunk_size: int = 500, overlap: int = 100) -> list:
    """
    Transforms a StructuredDocument into traceable DocumentChunk objects
    preserving Document name, Page number, and Evidence type.
    """
    chunks = []
    chunk_counter = 0

    for page in doc.pages:
        # 1. Digital text chunks
        if page.digital_text.strip():
            txt = page.digital_text.strip()
            step = max(50, chunk_size - overlap)
            for i in range(0, len(txt), step):
                segment = txt[i:i + chunk_size].strip()
                if segment:
                    c_id = f"{doc.filename}_p{page.page_num}_d{chunk_counter}"
                    chunks.append(DocumentChunk(
                        chunk_id=c_id,
                        source=doc.filename,
                        page=page.page_num,
                        content=segment,
                        evidence_type="DIGITAL_TEXT"
                    ))
                    chunk_counter += 1

        # 2. OCR text chunks
        if page.ocr_status == "SUCCESS" and page.ocr_text.strip():
            txt = page.ocr_text.strip()
            step = max(50, chunk_size - overlap)
            for i in range(0, len(txt), step):
                segment = txt[i:i + chunk_size].strip()
                if segment:
                    c_id = f"{doc.filename}_p{page.page_num}_ocr{chunk_counter}"
                    chunks.append(DocumentChunk(
                        chunk_id=c_id,
                        source=doc.filename,
                        page=page.page_num,
                        content=segment,
                        evidence_type="OCR_TRANSCRIPT"
                    ))
                    chunk_counter += 1

        # 3. Vision description chunks (engineering drawings / diagrams)
        if page.vision_analysis.strip():
            c_id = f"{doc.filename}_p{page.page_num}_vis{chunk_counter}"
            chunks.append(DocumentChunk(
                chunk_id=c_id,
                source=doc.filename,
                page=page.page_num,
                content=page.vision_analysis.strip(),
                evidence_type="VISION_ANALYSIS"
            ))
            chunk_counter += 1

    return chunks
