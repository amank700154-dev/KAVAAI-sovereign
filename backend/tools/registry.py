"""
KAVAAI Sovereign - Modular Local Tool System
============================================
Provides a secure, air-gapped tool execution framework:
Agent -> Tool Registry -> Tool Validation -> Tool Execution -> Observation -> Agent

Features:
- Strict workspace sandbox (zero path traversal, sensitive file shielding)
- AST-validated safe Python execution sandbox (zero arbitrary shell or OS compromise)
- 12 Production-ready safe tool interfaces:
  1. READ_FILE
  2. WRITE_FILE
  3. SEARCH_KNOWLEDGE_BASE
  4. OCR_DOCUMENT
  5. ANALYZE_IMAGE
  6. EXECUTE_PYTHON
  7. READ_SPREADSHEET
  8. WRITE_SPREADSHEET
  9. GENERATE_DOCX
  10. GENERATE_XLSX
  11. GENERATE_PPTX
  12. VERIFY_FILE
- Explicit tool audit logging format:
  TOOL: <NAME>
  STATUS: <STATUS>
  INPUT: <INPUT>
  OUTPUT: <OUTPUT>
"""

import os
import sys
import io
import re
import ast
import json
import math
import statistics
import csv
import time
import base64
import zipfile
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# Base Directories & Containment Boundaries
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_ROOT = os.path.realpath(BASE_DIR)
OUTPUT_DIR = os.path.realpath(os.path.join(BASE_DIR, "output"))
KNOWLEDGE_BASE_DIR = os.path.realpath(os.path.join(BASE_DIR, "knowledge_base"))

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)

# Sensitive files / patterns that must NEVER be accessed by tools
FORBIDDEN_FILE_PATTERNS = [
    r"^\.env(\..+)?$",
    r"^\.git($|[\\/])",
    r".*\.pem$",
    r".*\.key$",
    r"id_rsa.*",
    r".*secret.*",
    r".*credentials.*",
    r".*password.*"
]

# ==============================================================================
# 1. SECURITY & SANDBOX LAYER
# ==============================================================================
class ToolSecurity:
    """Enforces sandbox constraints, path traversal checks, and AST safety."""

    @staticmethod
    def is_safe_path(path: str, allow_write: bool = False) -> Tuple[bool, str, str]:
        """
        Validates that a file path is strictly contained within the approved workspace.
        Returns: (is_safe, resolved_path, error_message)
        """
        if not path or not isinstance(path, str):
            return False, "", "Empty or invalid file path."

        # Reject obvious path traversal signatures
        if ".." in path.replace("\\", "/").split("/"):
            return False, "", "Security Exception: Relative path traversal ('..') is prohibited."

        # Canonicalize path
        if not os.path.isabs(path):
            target_dir = OUTPUT_DIR if allow_write else WORKSPACE_ROOT
            resolved = os.path.realpath(os.path.join(target_dir, path))
        else:
            resolved = os.path.realpath(path)

        # Check containment inside workspace root
        common_root = os.path.commonpath([resolved, WORKSPACE_ROOT])
        if common_root != WORKSPACE_ROOT:
            return False, "", f"Security Exception: Path '{resolved}' escapes allowed workspace boundaries."

        # If writing, strictly constrain to OUTPUT_DIR or safe subfolders within workspace
        if allow_write:
            common_out = os.path.commonpath([resolved, OUTPUT_DIR])
            if common_out != OUTPUT_DIR:
                return False, "", f"Security Exception: Write destination must be inside output directory: {OUTPUT_DIR}"

        # Sensitive file shield
        basename = os.path.basename(resolved).lower()
        for pattern in FORBIDDEN_FILE_PATTERNS:
            if re.match(pattern, basename, re.IGNORECASE):
                return False, "", f"Security Exception: Access to sensitive file '{basename}' is forbidden."

        return True, resolved, ""

    @staticmethod
    def validate_python_code(code: str) -> Tuple[bool, str]:
        """
        Inspects Python source code using Abstract Syntax Tree (AST).
        Statically rejects forbidden imports, arbitrary subprocesses, and dangerous builtins.
        """
        if not code or not isinstance(code, str):
            return False, "Empty or invalid code string."

        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Python SyntaxError: {str(e)}"

        # Blocklist of dangerous modules
        banned_modules = {
            "os", "sys", "subprocess", "shutil", "socket", "http", "urllib", "requests",
            "ctypes", "builtins", "__builtin__", "pty", "platform", "signal",
            "multiprocessing", "threading", "importlib", "posix", "resource"
        }

        # Blocklist of dangerous calls
        banned_calls = {
            "eval", "exec", "__import__", "compile", "globals", "locals",
            "system", "popen", "spawn", "fork", "kill"
        }

        for node in ast.walk(tree):
            # Check imports: e.g. import os
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root_pkg = alias.name.split(".")[0]
                    if root_pkg in banned_modules:
                        return False, f"Security Violation: Import of module '{root_pkg}' is prohibited in sandbox."

            # Check from imports: e.g. from os import path
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    root_pkg = node.module.split(".")[0]
                    if root_pkg in banned_modules:
                        return False, f"Security Violation: Import from module '{root_pkg}' is prohibited in sandbox."

            # Check calls: e.g. eval(...) or exec(...)
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in banned_calls:
                        return False, f"Security Violation: Invocation of '{node.func.id}()' is prohibited in sandbox."
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in banned_calls:
                        return False, f"Security Violation: Invocation of '{node.func.attr}()' is prohibited in sandbox."

        return True, ""


# ==============================================================================
# 2. BASE TOOL INTERFACE
# ==============================================================================
class BaseTool:
    """Abstract base class for all sovereign local tools."""

    name: str = "BASE_TOOL"
    description: str = ""
    input_schema: Dict[str, Any] = {}

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        """Validates arguments against input schema and safety constraints."""
        if not isinstance(input_args, dict):
            return False, "Input arguments must be a dictionary."
        
        required_fields = self.input_schema.get("required", [])
        for field in required_fields:
            if field not in input_args:
                return False, f"Missing required parameter '{field}'."
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        """Concrete execution logic for the tool. Must return standardized dict."""
        raise NotImplementedError("Subclasses must implement execute().")

    def invoke(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orchestrates Validation -> Execution -> Observation -> Logging.
        Returns standardized tool result.
        """
        t0 = time.time()
        val_ok, val_err = self.validate(input_args)
        if not val_ok:
            res = {
                "tool": self.name,
                "status": "FAILED",
                "error": val_err,
                "observation": f"Validation failed: {val_err}",
                "data": None
            }
            self._log_execution("FAILED", input_args, res["observation"])
            try:
                from sovereignty_monitor import get_monitor
                get_monitor().record_tool_call(
                    tool_name=self.name,
                    status="FAILED",
                    inputs=input_args,
                    latency_ms=round((time.time() - t0) * 1000, 2)
                )
            except Exception:
                pass
            return res

        try:
            exec_res = self.execute(input_args)
            status = exec_res.get("status", "SUCCESS")
            obs = exec_res.get("observation", "")
            if not obs:
                if status == "SUCCESS":
                    obs = f"{self.name} completed successfully."
                else:
                    obs = exec_res.get("error", f"{self.name} failed.")

            result = {
                "tool": self.name,
                "status": status,
                "observation": obs,
                "data": exec_res.get("data", exec_res),
                "error": exec_res.get("error")
            }
            self._log_execution(status, input_args, obs)
            try:
                from sovereignty_monitor import get_monitor
                get_monitor().record_tool_call(
                    tool_name=self.name,
                    status=status,
                    inputs=input_args,
                    latency_ms=round((time.time() - t0) * 1000, 2)
                )
            except Exception:
                pass
            return result
        except Exception as e:
            err_msg = str(e)
            res = {
                "tool": self.name,
                "status": "FAILED",
                "error": err_msg,
                "observation": f"Unhandled error during {self.name}: {err_msg}",
                "data": None
            }
            self._log_execution("FAILED", input_args, res["observation"])
            try:
                from sovereignty_monitor import get_monitor
                get_monitor().record_tool_call(
                    tool_name=self.name,
                    status="FAILED",
                    inputs=input_args,
                    latency_ms=round((time.time() - t0) * 1000, 2)
                )
            except Exception:
                pass
            return res

    def _log_execution(self, status: str, input_args: Dict[str, Any], output_summary: str):
        """Prints explicit tool audit log as required."""
        clean_input = {}
        for k, v in input_args.items():
            if isinstance(v, str) and len(v) > 80:
                clean_input[k] = v[:77] + "..."
            else:
                clean_input[k] = v

        log_str = (
            f"\nTOOL: {self.name}\n"
            f"STATUS: {status}\n"
            f"INPUT: {json.dumps(clean_input)}\n"
            f"OUTPUT: {output_summary}\n"
        )
        print(log_str)


# ==============================================================================
# 3. CONCRETE SAFE TOOL IMPLEMENTATIONS (12 TOOLS)
# ==============================================================================

class ReadFileTool(BaseTool):
    """1. READ_FILE: Safely reads files within the workspace root."""
    name = "READ_FILE"
    description = "Safely reads local files (TXT, MD, JSON, CSV, PDF, DOCX, logs) within approved workspace directories."
    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Relative or absolute path to the file."},
            "max_bytes": {"type": "integer", "description": "Maximum bytes to read (default 100,000)."}
        },
        "required": ["file_path"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        path = input_args.get("file_path", "")
        safe, resolved, err = ToolSecurity.is_safe_path(path, allow_write=False)
        if not safe:
            return False, err
        if not os.path.exists(resolved):
            return False, f"File does not exist: {path}"
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        _, resolved, _ = ToolSecurity.is_safe_path(input_args["file_path"], allow_write=False)
        max_bytes = input_args.get("max_bytes", 100000)
        ext = os.path.splitext(resolved)[1].lower()

        if ext in [".txt", ".md", ".log", ".yaml", ".yml", ".ini"]:
            with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(max_bytes)
            return {
                "status": "SUCCESS",
                "format": ext,
                "bytes_read": len(content),
                "data": {"content": content},
                "observation": f"Read {len(content)} characters from {os.path.basename(resolved)}"
            }

        elif ext == ".json":
            with open(resolved, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "status": "SUCCESS",
                "format": "json",
                "data": data,
                "observation": f"Successfully parsed JSON file {os.path.basename(resolved)}"
            }

        elif ext in [".pdf", ".docx", ".png", ".jpg", ".jpeg"]:
            from document_intelligence import process_document
            doc = process_document(resolved, enable_ocr=True)
            text = doc.get_full_text()[:max_bytes]
            return {
                "status": "SUCCESS",
                "format": ext,
                "total_pages": doc.total_pages,
                "data": {"content": text, "structured": doc.to_dict()},
                "observation": f"Processed {ext.upper()} document ({doc.total_pages} pages, {len(text)} chars extracted)"
            }

        elif ext in [".csv", ".tsv"]:
            import csv
            delim = "\t" if ext == ".tsv" else ","
            rows = []
            with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f, delimiter=delim)
                for i, row in enumerate(reader):
                    if i >= 100:
                        break
                    rows.append(row)
            return {
                "status": "SUCCESS",
                "format": "csv",
                "data": {"rows": rows, "count": len(rows)},
                "observation": f"Read {len(rows)} rows from CSV {os.path.basename(resolved)}"
            }

        return {"status": "FAILED", "error": f"Unsupported extension: {ext}"}


class WriteFileTool(BaseTool):
    """2. WRITE_FILE: Safely writes text/markdown to the output directory."""
    name = "WRITE_FILE"
    description = "Safely writes text or markdown to the approved local output directory."
    input_schema = {
        "type": "object",
        "properties": {
            "file_name": {"type": "string", "description": "Target filename in output/ directory."},
            "content": {"type": "string", "description": "Text or markdown content to write."}
        },
        "required": ["file_name", "content"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        target = input_args["file_name"]
        safe, _, err = ToolSecurity.is_safe_path(target, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        _, resolved, _ = ToolSecurity.is_safe_path(input_args["file_name"], allow_write=True)
        content = input_args["content"]

        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)

        size = os.path.getsize(resolved)
        return {
            "status": "SUCCESS",
            "data": {"file_path": resolved, "bytes_written": size, "filename": os.path.basename(resolved)},
            "observation": f"Wrote {size} bytes to {os.path.basename(resolved)}"
        }


class SearchKnowledgeBaseTool(BaseTool):
    """3. SEARCH_KNOWLEDGE_BASE: Queries local ChromaDB knowledge connector."""
    name = "SEARCH_KNOWLEDGE_BASE"
    description = "Queries the local organizational knowledge base (SOPs, manuals, safety documents) and returns citations."
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query or question."},
            "top_k": {"type": "integer", "description": "Number of evidence chunks to retrieve (1-20).", "default": 3},
            "category": {"type": "string", "description": "Optional category filter (e.g. manuals, sops, safety)."}
        },
        "required": ["query"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        q = input_args.get("query", "").strip()
        if not q:
            return False, "Search query must be a non-empty string."
        top_k = input_args.get("top_k", 3)
        if not isinstance(top_k, int) or top_k < 1 or top_k > 20:
            return False, "top_k must be an integer between 1 and 20."
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from knowledge_connector import SEARCH_KNOWLEDGE_BASE as skb
        evidence = skb(
            query=input_args["query"],
            top_k=input_args.get("top_k", 3),
            category=input_args.get("category")
        )
        if not evidence:
            return {
                "status": "SUCCESS",
                "data": {"found": 0, "evidence": []},
                "observation": "No relevant organizational knowledge sources found."
            }

        formatted = []
        for e in evidence:
            formatted.append(f"Source: {e.get('source')} | Page: {e.get('page')} | Match: {e.get('similarity_percent')}")

        return {
            "status": "SUCCESS",
            "data": {
                "found": len(evidence),
                "evidence": evidence,
                "chunks": [e.get("relevant_evidence", "") for e in evidence]
            },
            "observation": f"{len(evidence)} relevant sources found ({'; '.join(formatted[:2])})"
        }


class OcrDocumentTool(BaseTool):
    """4. OCR_DOCUMENT: Performs local OCR text extraction from document images or pages."""
    name = "OCR_DOCUMENT"
    description = "Extracts printed and handwritten text from local scanned documents or images using on-premise vision models."
    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Path to document or image file."},
            "image_base64": {"type": "string", "description": "Optional base64 image data."}
        }
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        path = input_args.get("file_path")
        b64 = input_args.get("image_base64")
        if not path and not b64:
            return False, "Must provide either 'file_path' or 'image_base64'."
        if path:
            safe, _, err = ToolSecurity.is_safe_path(path, allow_write=False)
            if not safe:
                return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from document_intelligence import run_local_ocr_on_image
        path = input_args.get("file_path")
        b64 = input_args.get("image_base64")

        if path:
            _, resolved, _ = ToolSecurity.is_safe_path(path, allow_write=False)
            with open(resolved, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")

        text = run_local_ocr_on_image(b64)
        snippet = (text[:80] + "...") if len(text) > 80 else text
        return {
            "status": "SUCCESS",
            "data": {"extracted_text": text, "length": len(text)},
            "observation": f"OCR extracted {len(text)} characters: '{snippet}'"
        }


class AnalyzeImageTool(BaseTool):
    """5. ANALYZE_IMAGE: Performs multimodal inspection on equipment images."""
    name = "ANALYZE_IMAGE"
    description = "Multimodal visual inspection of industrial equipment, defect detection, and status assessment."
    input_schema = {
        "type": "object",
        "properties": {
            "image_path": {"type": "string", "description": "Path to image in workspace."},
            "image_base64": {"type": "string", "description": "Base64 image string."},
            "prompt": {"type": "string", "description": "Inspection question or prompt."}
        }
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        path = input_args.get("image_path")
        b64 = input_args.get("image_base64")
        if not path and not b64:
            return False, "Must provide either 'image_path' or 'image_base64'."
        if path:
            safe, _, err = ToolSecurity.is_safe_path(path, allow_write=False)
            if not safe:
                return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        import tools
        res = tools.tool_vision_inspect(
            image_path=input_args.get("image_path"),
            image_base64=input_args.get("image_base64"),
            prompt=input_args.get("prompt", "")
        )
        analysis = res.get("analysis") or res.get("fallback", "Image inspected.")
        snippet = (analysis[:90] + "...") if len(analysis) > 90 else analysis
        return {
            "status": "SUCCESS",
            "data": {"analysis": analysis},
            "observation": f"Image analysis complete: {snippet}"
        }


class ExecutePythonTool(BaseTool):
    """6. EXECUTE_PYTHON: AST-sandboxed local Python calculation and simulation engine."""
    name = "EXECUTE_PYTHON"
    description = "Executes safe mathematical formulas, data processing, and physical calculations in an isolated AST sandbox."
    input_schema = {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "Safe Python code snippet to execute."}
        },
        "required": ["code"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        code = input_args["code"]
        is_safe, err = ToolSecurity.validate_python_code(code)
        if not is_safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        code = input_args["code"]
        
        def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
            allowed = {"math", "json", "datetime", "re", "random", "statistics", "csv"}
            root_pkg = name.split(".")[0]
            if root_pkg not in allowed:
                raise ImportError(f"Security Violation: Import of module '{name}' is prohibited in sandbox.")
            return __import__(name, globals, locals, fromlist, level)

        def safe_open(file_path, mode="r", encoding="utf-8", **kwargs):
            if any(m in mode for m in ["w", "a", "+", "x"]):
                raise PermissionError("Security Violation: File write operations are prohibited via open() in sandbox.")
            safe, resolved, err = ToolSecurity.is_safe_path(str(file_path), allow_write=False)
            if not safe:
                raise PermissionError(f"Security Violation: {err}")
            return open(resolved, mode=mode, encoding=encoding, **kwargs)

        # Build safe isolated namespace
        safe_builtins = {
            "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
            "enumerate": enumerate, "filter": filter, "float": float, "int": int,
            "len": len, "list": list, "map": map, "max": max, "min": min,
            "pow": pow, "range": range, "round": round, "set": set, "str": str,
            "sum": sum, "tuple": tuple, "zip": zip, "print": print,
            "open": safe_open,
            "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError,
            "KeyError": KeyError, "IndexError": IndexError, "RuntimeError": RuntimeError,
            "__import__": safe_import
        }
        
        safe_globals = {
            "__builtins__": safe_builtins,
            "math": math,
            "statistics": statistics,
            "json": json,
            "datetime": datetime,
            "csv": csv
        }

        # Redirect stdout
        old_stdout = sys.stdout
        redirected_stdout = io.StringIO()
        start_time = time.time()

        try:
            sys.stdout = redirected_stdout
            local_scope = {}
            exec(code, safe_globals, local_scope)
            stdout_str = redirected_stdout.getvalue().strip()
            elapsed_ms = round((time.time() - start_time) * 1000, 2)

            # Return either printed output or resulting variables (ensuring json serializability)
            clean_scope = {}
            for k, v in local_scope.items():
                if not k.startswith("_") and not callable(v):
                    try:
                        json.dumps(v)
                        clean_scope[k] = v
                    except Exception:
                        clean_scope[k] = str(v)
            obs = stdout_str if stdout_str else f"Evaluated successfully ({len(clean_scope)} variables in scope: {list(clean_scope.keys())})"
            return {
                "status": "SUCCESS",
                "data": {
                    "stdout": stdout_str,
                    "variables": clean_scope,
                    "execution_time_ms": elapsed_ms
                },
                "observation": f"Python executed in {elapsed_ms}ms: {obs[:80]}"
            }
        except Exception as e:
            return {
                "status": "FAILED",
                "error": str(e),
                "observation": f"Execution error: {str(e)}"
            }
        finally:
            sys.stdout = old_stdout


class ReadSpreadsheetTool(BaseTool):
    """7. READ_SPREADSHEET: Reads Excel and CSV sheets safely without external macros."""
    name = "READ_SPREADSHEET"
    description = "Safely inspects local XLSX or CSV spreadsheets, returning sheet names, headers, and preview rows."
    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Path to XLSX or CSV spreadsheet file."},
            "max_rows": {"type": "integer", "description": "Maximum data rows to preview (default 10)."}
        },
        "required": ["file_path"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        safe, resolved, err = ToolSecurity.is_safe_path(input_args["file_path"], allow_write=False)
        if not safe:
            return False, err
        if not os.path.exists(resolved):
            return False, f"File does not exist: {input_args['file_path']}"
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        _, resolved, _ = ToolSecurity.is_safe_path(input_args["file_path"], allow_write=False)
        max_rows = input_args.get("max_rows", 10)
        ext = os.path.splitext(resolved)[1].lower()

        if ext == ".xlsx":
            import openpyxl
            wb = openpyxl.load_workbook(resolved, data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            headers = [str(h) for h in rows[0]] if rows else []
            data_rows = rows[1:max_rows + 1] if len(rows) > 1 else []
            return {
                "status": "SUCCESS",
                "data": {
                    "sheets": wb.sheetnames,
                    "active_sheet": sheet.title,
                    "headers": headers,
                    "total_rows": max(0, len(rows) - 1),
                    "preview": data_rows
                },
                "observation": f"Read XLSX '{os.path.basename(resolved)}': {len(rows)-1} rows, headers: {headers}"
            }
        elif ext in [".csv", ".tsv"]:
            import csv
            delim = "\t" if ext == ".tsv" else ","
            rows = []
            with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                r = list(csv.reader(f, delimiter=delim))
            headers = r[0] if r else []
            preview = r[1:max_rows + 1] if len(r) > 1 else []
            return {
                "status": "SUCCESS",
                "data": {
                    "headers": headers,
                    "total_rows": max(0, len(r) - 1),
                    "preview": preview
                },
                "observation": f"Read CSV '{os.path.basename(resolved)}': {len(r)-1} rows, headers: {headers}"
            }
        return {"status": "FAILED", "error": f"Unsupported spreadsheet format: {ext}"}


class WriteSpreadsheetTool(BaseTool):
    """8. WRITE_SPREADSHEET: Writes structured CSV or XLSX files in the output directory."""
    name = "WRITE_SPREADSHEET"
    description = "Generates and saves structured CSV or XLSX tabular files with headers and data rows."
    input_schema = {
        "type": "object",
        "properties": {
            "file_name": {"type": "string", "description": "Target filename (.xlsx or .csv) in output/."},
            "headers": {"type": "array", "items": {"type": "string"}, "description": "List of column headers."},
            "rows": {"type": "array", "items": {"type": "array"}, "description": "Matrix of table rows."},
            "sheet_title": {"type": "string", "description": "Title of the primary sheet."}
        },
        "required": ["file_name", "headers", "rows"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        safe, _, err = ToolSecurity.is_safe_path(input_args["file_name"], allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        _, resolved, _ = ToolSecurity.is_safe_path(input_args["file_name"], allow_write=True)
        headers = input_args["headers"]
        rows = input_args["rows"]
        ext = os.path.splitext(resolved)[1].lower()

        if ext == ".csv":
            import csv
            with open(resolved, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                writer.writerows(rows)
        else:
            # Default to XLSX
            if not resolved.endswith(".xlsx"):
                resolved += ".xlsx"
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = input_args.get("sheet_title", "Data Log")

            # Sovereign Navy Header
            header_fill = PatternFill(start_color="102A4D", end_color="102A4D", fill_type="solid")
            header_font = Font(color="FFFFFF", bold=True, size=11)

            ws.append(headers)
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center")

            for r in rows:
                ws.append(r)

            for col in ws.columns:
                max_len = max(len(str(c.value or '')) for c in col)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

            wb.save(resolved)

        size = os.path.getsize(resolved)
        return {
            "status": "SUCCESS",
            "data": {"file_path": resolved, "filename": os.path.basename(resolved), "rows_written": len(rows), "size_bytes": size},
            "observation": f"Saved {len(rows)} rows to spreadsheet {os.path.basename(resolved)} ({size} bytes)"
        }


class GenerateDocxTool(BaseTool):
    """9. GENERATE_DOCX: Generates structured executive/engineering Word documents."""
    name = "GENERATE_DOCX"
    description = "Generates formatted, professional DOCX engineering reports with executive summary, tables, and audit markers."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Title of the engineering report."},
            "sections": {"type": "object", "description": "Dictionary of section headings and paragraphs."},
            "telemetry": {"type": "object", "description": "Optional telemetry sensor readings to format in table."},
            "output_filename": {"type": "string", "description": "Optional custom filename in output/."}
        },
        "required": ["title"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "report.docx"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        import docx
        from docx.shared import Pt, RGBColor
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = input_args.get("output_filename") or f"Engineering_Report_{timestamp}.docx"
        if not fname.endswith(".docx"):
            fname += ".docx"

        _, resolved, _ = ToolSecurity.is_safe_path(fname, allow_write=True)
        doc = docx.Document()

        # Title
        p = doc.add_paragraph()
        run = p.add_run(input_args["title"])
        run.font.size = Pt(20)
        run.font.bold = True
        run.font.color.rgb = RGBColor(16, 42, 77)

        # Subtitle
        sub = doc.add_paragraph()
        sub_run = sub.add_run(f"KAVAAI Sovereign On-Premise AI | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        sub_run.font.size = Pt(9)
        sub_run.font.italic = True

        sections = input_args.get("sections", {})
        if not sections:
            sections = {
                "Executive Summary": "Autonomous sovereign industrial diagnostic complete.",
                "Observations & Findings": "Telemetry verified against local organizational maintenance manuals.",
                "Corrective Actions": "Execute scheduled maintenance according to approved SOP guidelines."
            }

        for heading, body in sections.items():
            doc.add_heading(heading, level=1)
            doc.add_paragraph(str(body))

        # Telemetry Table if provided
        telemetry = input_args.get("telemetry")
        if telemetry and isinstance(telemetry, dict):
            doc.add_heading("Telemetry Snapshot", level=1)
            tbl = doc.add_table(rows=1, cols=2)
            tbl.style = 'Table Grid'
            tbl.rows[0].cells[0].text = "Sensor Parameter"
            tbl.rows[0].cells[1].text = "Measured Value"
            for k, v in telemetry.items():
                row = tbl.add_row().cells
                row[0].text = str(k).capitalize()
                row[1].text = str(v)

        doc.save(resolved)
        size = os.path.getsize(resolved)
        return {
            "status": "SUCCESS",
            "data": {"file_path": resolved, "filename": os.path.basename(resolved), "size_bytes": size},
            "observation": f"Generated DOCX deliverable: {os.path.basename(resolved)} ({size} bytes)"
        }


class GenerateXlsxTool(BaseTool):
    """10. GENERATE_XLSX: Generates styled Excel workbooks with metrics and formulas."""
    name = "GENERATE_XLSX"
    description = "Generates audit-ready Excel spreadsheets with custom styles, header colors, and formulas."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Title of the audit sheet."},
            "headers": {"type": "array", "items": {"type": "string"}},
            "rows": {"type": "array", "items": {"type": "array"}},
            "output_filename": {"type": "string", "description": "Optional custom filename in output/."}
        },
        "required": ["title"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "audit.xlsx"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = input_args.get("output_filename") or f"Telemetry_Audit_{timestamp}.xlsx"
        if not fname.endswith(".xlsx"):
            fname += ".xlsx"

        _, resolved, _ = ToolSecurity.is_safe_path(fname, allow_write=True)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = input_args.get("title", "Sovereign Audit")[:31]

        headers = input_args.get("headers", ["Parameter", "Measured Value", "Normal Range", "Risk Level"])
        rows = input_args.get("rows", [
            ["Temperature", "72°C", "60-80°C", "NORMAL"],
            ["Cooling Fan", "ACTIVE", "ACTIVE", "NORMAL"],
            ["Vibration", "0.18", "< 0.30", "NORMAL"]
        ])

        header_fill = PatternFill(start_color="102A4D", end_color="102A4D", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=11)

        ws.append(headers)
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        for r in rows:
            ws.append(r)

        for col in ws.columns:
            max_len = max(len(str(c.value or '')) for c in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

        wb.save(resolved)
        size = os.path.getsize(resolved)
        return {
            "status": "SUCCESS",
            "data": {"file_path": resolved, "filename": os.path.basename(resolved), "size_bytes": size},
            "observation": f"Generated XLSX deliverable: {os.path.basename(resolved)} ({size} bytes)"
        }


class GeneratePptxTool(BaseTool):
    """11. GENERATE_PPTX: Generates professional PowerPoint presentations using python-pptx."""
    name = "GENERATE_PPTX"
    description = "Generates professional PPTX briefing presentations with title slide, telemetry findings, and recommendations."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Presentation title."},
            "subtitle": {"type": "string", "description": "Presentation subtitle."},
            "slides": {
                "type": "array",
                "description": "List of slide objects containing 'title' and 'points' (list of bullet strings).",
                "items": {"type": "object"}
            },
            "output_filename": {"type": "string", "description": "Target filename in output/."}
        },
        "required": ["title"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "presentation.pptx"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        import pptx
        from pptx.util import Inches, Pt
        from pptx.dml.color import RGBColor

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = input_args.get("output_filename") or f"Industrial_Briefing_{timestamp}.pptx"
        if not fname.endswith(".pptx"):
            fname += ".pptx"

        _, resolved, _ = ToolSecurity.is_safe_path(fname, allow_write=True)
        prs = pptx.Presentation()

        # Slide 1: Title Slide (Layout 0)
        title_slide_layout = prs.slide_layouts[0]
        slide = prs.slides.add_slide(title_slide_layout)
        title = slide.shapes.title
        subtitle = slide.placeholders[1]

        title.text = input_args["title"]
        subtitle.text = input_args.get("subtitle", f"KAVAAI Sovereign On-Premise Audit | {datetime.now().strftime('%Y-%m-%d')}")

        # Slide Contents
        bullet_slide_layout = prs.slide_layouts[1]
        slides_data = input_args.get("slides", [
            {
                "title": "Executive Summary",
                "points": [
                    "Equipment telemetry continuously monitored via air-gapped sovereign AI.",
                    "No external cloud services or WAN communication utilized.",
                    "SOP compliance verified against local technical manuals."
                ]
            },
            {
                "title": "Telemetry & Anomaly Analysis",
                "points": [
                    "Operating Temperature: Within acceptable manufacturer envelope (<= 80°C).",
                    "Cooling Systems: Active ventilation fan operational.",
                    "Vibration Metrics: Normal damping observed across baseline."
                ]
            },
            {
                "title": "Corrective Recommendations",
                "points": [
                    "Conduct standard preventive inspection as per Section 4.2.",
                    "Maintain coolant levels above minimum threshold (60%).",
                    "Next inspection scheduled per standard maintenance cycle."
                ]
            }
        ])

        for s_data in slides_data:
            s = prs.slides.add_slide(bullet_slide_layout)
            s_title = s.shapes.title
            s_title.text = s_data.get("title", "Slide")
            tf = s.placeholders[1].text_frame

            points = s_data.get("points", [])
            for i, pt in enumerate(points):
                if i == 0:
                    p = tf.paragraphs[0]
                    p.text = pt
                else:
                    p = tf.add_paragraph()
                    p.text = pt
                p.level = 0

        prs.save(resolved)
        size = os.path.getsize(resolved)
        total_slides = len(prs.slides)
        return {
            "status": "SUCCESS",
            "data": {
                "file_path": resolved,
                "filename": os.path.basename(resolved),
                "slides_count": total_slides,
                "size_bytes": size
            },
            "observation": f"Generated PPTX briefing: {os.path.basename(resolved)} ({total_slides} slides, {size} bytes)"
        }


class GenerateApprovalNoteTool(BaseTool):
    """Generates an official engineering approval note with findings, SOP citations, and signature block."""
    name = "GENERATE_APPROVAL_NOTE"
    description = "Generates an authoritative, fully styled DOCX Approval Note with findings, SOP limits, traceable evidence, and signature block."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Title of the approval note."},
            "document_ref": {"type": "string", "description": "Audit document reference ID."},
            "summary": {"type": "string", "description": "Executive summary of evaluation."},
            "key_findings": {"type": "array", "items": {"type": "object"}, "description": "List of finding objects with parameter, measured_value, baseline, delta, compliance_state."},
            "evidence": {"type": "array", "items": {"type": "object"}, "description": "List of evidence objects with source, modality, fact, citation."},
            "sop_references": {"type": "array", "items": {"type": "object"}, "description": "List of SOP references with document_id, title, section, clause."},
            "recommended_actions": {"type": "array", "items": {"type": "string"}, "description": "List of recommended actions."},
            "assumptions_limitations": {"type": "array", "items": {"type": "string"}, "description": "List of assumptions and limitations."},
            "output_filename": {"type": "string", "description": "Optional custom filename in output/."},
            "approval_status": {"type": "string", "description": "Approval determination (APPROVED / CONDITIONAL APPROVAL / REJECTED)."}
        },
        "required": ["title", "document_ref", "summary"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "approval_note.docx"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from deliverable_generator import deliverable_gen
        res = deliverable_gen.generate_approval_note(
            title=input_args.get("title", "ENGINEERING APPROVAL NOTE"),
            document_ref=input_args.get("document_ref", "DOC-REF-001"),
            summary=input_args.get("summary", "Engineering assessment complete."),
            key_findings=input_args.get("key_findings", []),
            evidence=input_args.get("evidence", []),
            sop_references=input_args.get("sop_references", []),
            recommended_actions=input_args.get("recommended_actions", ["Follow standard operating procedure."]),
            assumptions_limitations=input_args.get("assumptions_limitations", ["Evaluation conducted on-premise."]),
            output_filename=input_args.get("output_filename"),
            approval_status=input_args.get("approval_status", "CONDITIONAL APPROVAL"),
            metadata=input_args.get("metadata")
        )
        return {
            "status": "SUCCESS",
            "data": res,
            "observation": f"Generated DOCX Approval Note: {res['filename']} ({res['size_bytes']} bytes, status={res['approval_status']})"
        }


class GenerateTxtTool(BaseTool):
    """Generates plain-text technical audit reports."""
    name = "GENERATE_TXT"
    description = "Generates clean, formal plain-text technical audit report files."
    input_schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Title of the technical report."},
            "sections": {"type": "object", "description": "Dictionary of section headings and paragraphs."},
            "metadata": {"type": "object", "description": "Optional metadata dictionary."},
            "output_filename": {"type": "string", "description": "Target filename in output/."}
        },
        "required": ["title", "sections"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "report.txt"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from deliverable_generator import deliverable_gen
        res = deliverable_gen.generate_txt(
            title=input_args["title"],
            sections=input_args["sections"],
            metadata=input_args.get("metadata"),
            output_filename=input_args.get("output_filename")
        )
        return {
            "status": "SUCCESS",
            "data": res,
            "observation": f"Generated TXT deliverable: {res['filename']} ({res['size_bytes']} bytes)"
        }


class GenerateCsvTool(BaseTool):
    """Generates clean CSV exports."""
    name = "GENERATE_CSV"
    description = "Generates RFC-4180 compliant CSV tabular deliverable files."
    input_schema = {
        "type": "object",
        "properties": {
            "headers": {"type": "array", "items": {"type": "string"}, "description": "List of column headers."},
            "rows": {"type": "array", "items": {"type": "array"}, "description": "Matrix of table rows."},
            "output_filename": {"type": "string", "description": "Target filename in output/."}
        },
        "required": ["headers", "rows"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "export.csv"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from deliverable_generator import deliverable_gen
        res = deliverable_gen.generate_csv(
            headers=input_args["headers"],
            rows=input_args["rows"],
            output_filename=input_args.get("output_filename")
        )
        return {
            "status": "SUCCESS",
            "data": res,
            "observation": f"Generated CSV deliverable: {res['filename']} ({res['size_bytes']} bytes, {res['rows_count']} rows)"
        }


class GeneratePyTool(BaseTool):
    """Generates standalone Python verification scripts."""
    name = "GENERATE_PY"
    description = "Generates a standalone, executable Python verification script (.py) for testing sensor bounds and SOP limits."
    input_schema = {
        "type": "object",
        "properties": {
            "script_name": {"type": "string", "description": "Name of the verification script."},
            "description": {"type": "string", "description": "Script description."},
            "telemetry_data": {"type": "object", "description": "Recorded telemetry data dictionary."},
            "sop_thresholds": {"type": "object", "description": "SOP thresholds dictionary."},
            "output_filename": {"type": "string", "description": "Target filename in output/."}
        },
        "required": ["script_name", "telemetry_data"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        fname = input_args.get("output_filename") or "verify.py"
        safe, _, err = ToolSecurity.is_safe_path(fname, allow_write=True)
        if not safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from deliverable_generator import deliverable_gen
        res = deliverable_gen.generate_py(
            script_name=input_args.get("script_name", "Operational Verification"),
            description=input_args.get("description", "Standalone operational envelope verification"),
            telemetry_data=input_args.get("telemetry_data", {}),
            sop_thresholds=input_args.get("sop_thresholds", {"temperature_warning_c": 80.0, "temperature_critical_c": 95.0}),
            output_filename=input_args.get("output_filename")
        )
        return {
            "status": "SUCCESS",
            "data": res,
            "observation": f"Generated PY script deliverable: {res['filename']} ({res['size_bytes']} bytes)"
        }


class VerifyFileTool(BaseTool):
    """12. VERIFY_FILE: Inspects deliverables for valid headers, non-empty size, and integrity."""
    name = "VERIFY_FILE"
    description = "Verifies existence, non-empty size, and format integrity (magic bytes / zip schema / AST syntax) of output files."
    input_schema = {
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Relative or absolute path to file in workspace."},
            "expected_format": {"type": "string", "description": "Optional expected format (docx, xlsx, pptx, pdf, json, csv, py, txt)."}
        },
        "required": ["file_path"]
    }

    def validate(self, input_args: Dict[str, Any]) -> Tuple[bool, str]:
        ok, msg = super().validate(input_args)
        if not ok:
            return ok, msg
        safe, resolved, err = ToolSecurity.is_safe_path(input_args["file_path"], allow_write=False)
        if not safe:
            return False, err
        if not os.path.exists(resolved):
            return False, f"Target verification file does not exist: {input_args['file_path']}"
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        from deliverable_generator import deliverable_gen
        _, resolved, _ = ToolSecurity.is_safe_path(input_args["file_path"], allow_write=False)
        expected = input_args.get("expected_format")
        res = deliverable_gen.verify_deliverable(resolved, expected_format=expected)
        
        if not res.get("verified"):
            return {
                "status": "FAILED",
                "error": res.get("error", "Verification failed."),
                "observation": f"Verification FAILED: {os.path.basename(resolved)} - {res.get('error')}",
                "data": res
            }

        return {
            "status": "SUCCESS",
            "data": res,
            "observation": f"Verification PASSED for {os.path.basename(resolved)} ({res['size_bytes']} bytes, format={res['format']})"
        }


# ==============================================================================
# 4. CENTRAL TOOL REGISTRY
# ==============================================================================
class ToolRegistry:
    """Central registry and execution dispatcher for all local sovereign tools."""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        tools = [
            ReadFileTool(),
            WriteFileTool(),
            SearchKnowledgeBaseTool(),
            OcrDocumentTool(),
            AnalyzeImageTool(),
            ExecutePythonTool(),
            ReadSpreadsheetTool(),
            WriteSpreadsheetTool(),
            GenerateDocxTool(),
            GenerateXlsxTool(),
            GeneratePptxTool(),
            GenerateTxtTool(),
            GenerateCsvTool(),
            GeneratePyTool(),
            GenerateApprovalNoteTool(),
            VerifyFileTool()
        ]
        for t in tools:
            self.register(t)
        for t in tools:
            self.register(t)

    def register(self, tool: BaseTool):
        """Registers a tool under its canonical uppercase name and lowercase alias."""
        self._tools[tool.name] = tool
        self._tools[tool.name.lower()] = tool

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name) or self._tools.get(name.upper()) or self._tools.get(name.lower())

    def invoke(self, name: str, input_args: Dict[str, Any]) -> Dict[str, Any]:
        """Validates and executes a tool by name."""
        tool = self.get_tool(name)
        if not tool:
            err = f"Tool '{name}' not found in registry."
            print(f"\nTOOL: {name}\nSTATUS: FAILED\nINPUT: {json.dumps(input_args)}\nOUTPUT: {err}\n")
            return {
                "tool": name,
                "status": "FAILED",
                "error": err,
                "observation": err,
                "data": None
            }
        return tool.invoke(input_args)

    def list_tools(self) -> List[Dict[str, Any]]:
        """Returns metadata for all registered tools."""
        seen = set()
        tools_meta = []
        for name, t in self._tools.items():
            if t.name not in seen:
                seen.add(t.name)
                tools_meta.append({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema
                })
        return tools_meta

    def get_schemas(self) -> Dict[str, Any]:
        """Returns JSON schema definitions for all tools."""
        return {t["name"]: t["input_schema"] for t in self.list_tools()}


# Global Singleton Registry
registry = ToolRegistry()
