"""
KAVAAI Sovereign - Sandbox Security Validator
=============================================
AST-level code inspection and path containment security:
- Abstract Syntax Tree (AST) validation rejecting dangerous calls, modules, and builtins.
- Strict workspace path confinement preventing directory traversal ("..") and unauthorized writes.
- Sensitive file access shields (.env, keys, credentials).
"""

import os
import re
import ast
from typing import Tuple

# Workspace root path
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(WORKSPACE_ROOT, "workspace", "output")
LEGACY_OUTPUT_DIR = os.path.join(WORKSPACE_ROOT, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(LEGACY_OUTPUT_DIR, exist_ok=True)

FORBIDDEN_FILE_PATTERNS = [
    r"\.env.*",
    r"\.git.*",
    r".*\.pem$",
    r".*\.key$",
    r"id_rsa.*",
    r".*secret.*",
    r".*credentials.*",
    r".*password.*"
]


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
        try:
            common_root = os.path.commonpath([resolved, WORKSPACE_ROOT])
            if common_root != WORKSPACE_ROOT:
                return False, "", f"Security Exception: Path '{resolved}' escapes allowed workspace boundaries."
        except ValueError:
            return False, "", f"Security Exception: Path '{resolved}' is on a different drive or invalid."

        # If writing, strictly constrain to OUTPUT_DIR or safe subfolders within workspace
        if allow_write:
            try:
                common_out = os.path.commonpath([resolved, OUTPUT_DIR])
                common_legacy = os.path.commonpath([resolved, LEGACY_OUTPUT_DIR])
                if common_out != OUTPUT_DIR and common_legacy != LEGACY_OUTPUT_DIR:
                    return False, "", f"Security Exception: Write destination must be inside output directory: {OUTPUT_DIR}"
            except ValueError:
                return False, "", "Security Exception: Invalid destination path."

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
                    root_mod = alias.name.split(".")[0]
                    if root_mod in banned_modules:
                        return False, f"Security Violation: Import of module '{alias.name}' is prohibited in safe sandbox."

            # Check from imports: e.g. from subprocess import run
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    root_mod = node.module.split(".")[0]
                    if root_mod in banned_modules:
                        return False, f"Security Violation: Import from module '{node.module}' is prohibited in safe sandbox."

            # Check direct function calls: e.g. eval(), exec()
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in banned_calls:
                        return False, f"Security Violation: Execution of function '{node.func.id}()' is prohibited in safe sandbox."
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr in banned_calls:
                        return False, f"Security Violation: Invocation of method '{node.func.attr}()' is prohibited in safe sandbox."

        return True, ""
