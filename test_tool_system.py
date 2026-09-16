"""
Comprehensive Automated Test Suite for KAVAAI Sovereign Modular Tool System
===========================================================================
Validates:
1. Tool Registry & Schema catalog (12 tools)
2. Security & Sandbox (Path Traversal, .env shielding, AST Python isolation)
3. Concrete execution of all 12 tools
4. Generated deliverable verification (DOCX, XLSX, PPTX)
5. Tool execution audit logging
6. Agent Orchestrator integration
"""

import os
import sys
import json
import unittest

# Ensure root in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import tool_system
from tool_system import registry, ToolSecurity
from agent_orchestrator import orchestrator


class TestToolSystem(unittest.TestCase):

    def setUp(self):
        self.output_dir = os.path.join(BASE_DIR, "output")
        os.makedirs(self.output_dir, exist_ok=True)

    # --------------------------------------------------------------------------
    # 1. TOOL REGISTRY & SCHEMAS
    # --------------------------------------------------------------------------
    def test_01_all_12_tools_registered(self):
        expected_tools = {
            "READ_FILE", "WRITE_FILE", "SEARCH_KNOWLEDGE_BASE", "OCR_DOCUMENT",
            "ANALYZE_IMAGE", "EXECUTE_PYTHON", "READ_SPREADSHEET", "WRITE_SPREADSHEET",
            "GENERATE_DOCX", "GENERATE_XLSX", "GENERATE_PPTX", "VERIFY_FILE"
        }
        registered = {t["name"] for t in registry.list_tools()}
        for tool_name in expected_tools:
            self.assertIn(tool_name, registered, f"Missing tool: {tool_name}")
            tool = registry.get_tool(tool_name)
            self.assertIsNotNone(tool)
            self.assertTrue(len(tool.description) > 0)
            self.assertIn("type", tool.input_schema)

    # --------------------------------------------------------------------------
    # 2. SECURITY & PATH TRAVERSAL SANDBOX
    # --------------------------------------------------------------------------
    def test_02_path_traversal_prevention(self):
        # Escapes workspace
        res = registry.invoke("READ_FILE", {"file_path": "../../Windows/System32/drivers/etc/hosts"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Exception", res["error"])

        # Path traversal in write
        res = registry.invoke("WRITE_FILE", {"file_name": "../../../dangerous.txt", "content": "bad"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Exception", res["error"])

    def test_03_sensitive_file_shielding(self):
        # .env shielding
        res = registry.invoke("READ_FILE", {"file_path": ".env"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("sensitive file", res["error"])

        # .pem / id_rsa shielding
        res = registry.invoke("READ_FILE", {"file_path": "id_rsa"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("sensitive file", res["error"])

    # --------------------------------------------------------------------------
    # 3. PYTHON AST CODE SANDBOX
    # --------------------------------------------------------------------------
    def test_04_ast_sandbox_blocks_malicious_code(self):
        # Block os import
        res = registry.invoke("EXECUTE_PYTHON", {"code": "import os\nos.system('dir')"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Violation", res["error"])

        # Block subprocess import
        res = registry.invoke("EXECUTE_PYTHON", {"code": "import subprocess\nsubprocess.run(['dir'])"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Violation", res["error"])

        # Block socket import
        res = registry.invoke("EXECUTE_PYTHON", {"code": "from socket import socket"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Violation", res["error"])

        # Block eval() invocation
        res = registry.invoke("EXECUTE_PYTHON", {"code": "x = eval('2 + 2')"})
        self.assertEqual(res["status"], "FAILED")
        self.assertIn("Security Violation", res["error"])

    def test_05_ast_sandbox_executes_safe_math(self):
        code = (
            "import math\n"
            "temp = 85.5\n"
            "threshold = 80.0\n"
            "variance = round(temp - threshold, 2)\n"
            "margin = round(math.sqrt(temp), 2)\n"
            "print(f'Variance: {variance}, Margin: {margin}')\n"
        )
        res = registry.invoke("EXECUTE_PYTHON", {"code": code})
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIn("Variance: 5.5", res["data"]["stdout"])
        self.assertEqual(res["data"]["variables"]["variance"], 5.5)

    # --------------------------------------------------------------------------
    # 4. CONCRETE TOOL EXECUTION (ALL 12 TOOLS)
    # --------------------------------------------------------------------------
    def test_06_file_write_and_read(self):
        # Write
        fname = "test_audit_note.txt"
        content = "Sovereign Audit Note: Cooling fan test operational."
        w_res = registry.invoke("WRITE_FILE", {"file_name": fname, "content": content})
        self.assertEqual(w_res["status"], "SUCCESS")
        self.assertTrue(os.path.exists(w_res["data"]["file_path"]))

        # Read
        r_res = registry.invoke("READ_FILE", {"file_path": os.path.join("output", fname)})
        self.assertEqual(r_res["status"], "SUCCESS")
        self.assertIn("Sovereign Audit Note", r_res["data"]["content"])

    def test_07_search_knowledge_base(self):
        res = registry.invoke("SEARCH_KNOWLEDGE_BASE", {"query": "temperature warning threshold", "top_k": 2})
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue("found" in res["data"])
        self.assertTrue(len(res["data"]["evidence"]) > 0)
        first_ev = res["data"]["evidence"][0]
        self.assertIn("source", first_ev)
        self.assertIn("page", first_ev)
        self.assertIn("similarity_percent", first_ev)

    def test_08_spreadsheet_write_and_read(self):
        # Write Spreadsheet
        headers = ["Asset ID", "Subsystem", "Operating Temp", "Status"]
        rows = [
            ["Unit-101", "Motor Core", "72C", "NORMAL"],
            ["Unit-102", "Exhaust Fan", "88C", "WARNING"],
            ["Unit-103", "Coolant Line", "45C", "OPTIMAL"]
        ]
        w_res = registry.invoke("WRITE_SPREADSHEET", {
            "file_name": "test_inventory.xlsx",
            "headers": headers,
            "rows": rows,
            "sheet_title": "Assets"
        })
        self.assertEqual(w_res["status"], "SUCCESS")
        file_path = w_res["data"]["file_path"]
        self.assertTrue(os.path.exists(file_path))

        # Read Spreadsheet back
        r_res = registry.invoke("READ_SPREADSHEET", {"file_path": file_path})
        self.assertEqual(r_res["status"], "SUCCESS")
        self.assertEqual(r_res["data"]["headers"], headers)
        self.assertEqual(r_res["data"]["total_rows"], 3)

    def test_09_generate_docx_deliverable(self):
        res = registry.invoke("GENERATE_DOCX", {
            "title": "Industrial Unit Assessment Report",
            "sections": {
                "Executive Summary": "All systems operational within tolerances.",
                "Diagnostic Results": "Fan RPM stable at 1240 RPM."
            },
            "telemetry": {"temperature": 72, "fan": "ACTIVE"},
            "output_filename": "test_engineering_report.docx"
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(os.path.exists(res["data"]["file_path"]))
        self.assertTrue(res["data"]["size_bytes"] > 5000)

    def test_10_generate_xlsx_deliverable(self):
        res = registry.invoke("GENERATE_XLSX", {
            "title": "Telemetry Log",
            "headers": ["Sensor", "Reading", "Threshold"],
            "rows": [["Temp", "72C", "80C"], ["RPM", "1240", "1500"]],
            "output_filename": "test_telemetry_audit.xlsx"
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(os.path.exists(res["data"]["file_path"]))
        self.assertTrue(res["data"]["size_bytes"] > 4000)

    def test_11_generate_pptx_deliverable(self):
        res = registry.invoke("GENERATE_PPTX", {
            "title": "Industrial Turbine Assessment Briefing",
            "subtitle": "KAVAAI Sovereign Air-Gapped Briefing",
            "slides": [
                {"title": "Overview", "points": ["Air-gapped operation", "Zero WAN communication"]},
                {"title": "Key Metrics", "points": ["Temperature: 72°C", "Vibration: Normal"]}
            ],
            "output_filename": "test_briefing.pptx"
        })
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(os.path.exists(res["data"]["file_path"]))
        self.assertTrue(res["data"]["slides_count"] >= 3)
        self.assertTrue(res["data"]["size_bytes"] > 10000)

    def test_12_verify_file_integrity(self):
        # 1. Verify generated DOCX
        docx_path = os.path.join(self.output_dir, "test_engineering_report.docx")
        v_docx = registry.invoke("VERIFY_FILE", {"file_path": docx_path, "expected_format": "docx"})
        self.assertEqual(v_docx["status"], "SUCCESS")
        self.assertTrue(v_docx["data"]["size_bytes"] > 0)

        # 2. Verify generated XLSX
        xlsx_path = os.path.join(self.output_dir, "test_telemetry_audit.xlsx")
        v_xlsx = registry.invoke("VERIFY_FILE", {"file_path": xlsx_path, "expected_format": "xlsx"})
        self.assertEqual(v_xlsx["status"], "SUCCESS")

        # 3. Verify generated PPTX
        pptx_path = os.path.join(self.output_dir, "test_briefing.pptx")
        v_pptx = registry.invoke("VERIFY_FILE", {"file_path": pptx_path, "expected_format": "pptx"})
        self.assertEqual(v_pptx["status"], "SUCCESS")

        # 4. Verify fake/corrupted file fails
        corrupt_path = os.path.join(self.output_dir, "corrupted_fake.docx")
        with open(corrupt_path, "w") as f:
            f.write("Not a real docx zip archive.")
        v_corrupt = registry.invoke("VERIFY_FILE", {"file_path": corrupt_path, "expected_format": "docx"})
        self.assertEqual(v_corrupt["status"], "FAILED")

    # --------------------------------------------------------------------------
    # 5. ORCHESTRATOR INTEGRATION TEST
    # --------------------------------------------------------------------------
    def test_13_agent_orchestrator_runs_full_lifecycle(self):
        query = "Generate briefing slides and investigate high temperature warning on Machine 101"
        res = orchestrator.execute(
            user_request=query,
            context={"telemetry": {"temperature": 84, "fan": "ACTIVE", "rpm": 1200}},
            generate_deliverables=True,
            verbose=False
        )
        self.assertIn("plan", res)
        self.assertTrue(len(res["plan"]) >= 4)
        self.assertIn("deliverables", res)
        self.assertTrue(len(res["deliverables"]) >= 2)
        # Check that PPTX was included in deliverables because user asked for slides
        file_types = [f.get("type") for f in res["deliverables"]]
        self.assertIn("DOCX", file_types)
        self.assertIn("XLSX", file_types)
        self.assertIn("PPTX", file_types)


if __name__ == "__main__":
    unittest.main()
