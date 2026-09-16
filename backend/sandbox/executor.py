"""
KAVAAI Sovereign - Safe Python AST Sandbox Executor
===================================================
Executes verified Python formulas, data processing scripts, and telemetry
calculations in an isolated AST sandbox with redirected stdout and safe builtins.
"""

import sys
import io
import time
import json
import math
import statistics
import datetime
import csv
from typing import Dict, Any, Tuple
from backend.sandbox.security import ToolSecurity


class ExecutePythonTool:
    """AST-sandboxed local Python calculation and simulation engine."""
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
        if not isinstance(input_args, dict) or "code" not in input_args:
            return False, "Missing required parameter 'code'."
        code = input_args["code"]
        is_safe, err = ToolSecurity.validate_python_code(code)
        if not is_safe:
            return False, err
        return True, ""

    def execute(self, input_args: Dict[str, Any]) -> Dict[str, Any]:
        val_ok, val_err = self.validate(input_args)
        if not val_ok:
            return {"status": "FAILED", "error": val_err, "observation": f"Validation error: {val_err}"}

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
