"""
test_end_to_end_integration.py
==============================
Comprehensive End-to-End Integration Verification for SIH26117:
1. Killer Workflow: Scanned Inspection Report -> Local OCR -> Multimodal Vision ->
   SOP Retrieval -> Evidence Synthesis -> DOCX Approval Note -> OpenXML Verification -> Deliverable Downloads.
2. Secondary Demo: Coding Request -> Task Classification -> CODING_MODEL Selection ->
   CSV Ingestion -> AST Sandbox Execution -> Statistical Assertions -> Self-Healing -> Verified PY Output.
3. Backend REST API Endpoints & Sovereignty Enforcement.
"""

import unittest
import os
import sys
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR) if os.path.basename(BASE_DIR) == "tests" else BASE_DIR
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
OUTPUT_DIR = os.path.join(ROOT_DIR, "output")

from agent_orchestrator import orchestrator
from deliverable_generator import deliverable_gen
import backend


class TestEndToEndIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = backend.app.test_client()

    # =========================================================================
    # 1. KILLER WORKFLOW TESTS
    # =========================================================================
    def test_01_killer_workflow_orchestration(self):
        """Tests complete 10-step Killer Workflow from user request to verified deliverables."""
        req = (
            "Analyze this inspection report, identify important findings, "
            "retrieve the relevant local SOP/manual information, assess the findings "
            "using available evidence, and generate an approval note."
        )
        res = orchestrator.execute(req, generate_deliverables=True, verbose=False)

        # 1. Task classification & plan
        self.assertEqual(res["task_type"], "APPROVAL_NOTE_GENERATION")
        self.assertIn(res["decision"], ["BOTH", "MANUAL_SEARCH"])
        self.assertGreaterEqual(len(res["plan"]), 8)

        # 2. Plan step tools
        executed_tools = [p["tool"] for p in res["plan"]]
        self.assertIn("READ_FILE", executed_tools)
        self.assertIn("SEARCH_KNOWLEDGE_BASE", executed_tools)
        self.assertIn("GENERATE_APPROVAL_NOTE", executed_tools)

        # 3. Approval Note Structure (all 9 mandatory sections)
        appr = res.get("approval_note")
        self.assertIsNotNone(appr, "Approval Note object must be present")
        self.assertIn("title", appr)
        self.assertIn("document_ref", appr)
        self.assertIn("summary", appr)
        self.assertIn("key_findings", appr)
        self.assertIn("evidence", appr)
        self.assertIn("sop_references", appr)
        self.assertIn("recommended_actions", appr)
        self.assertIn("assumptions_limitations", appr)
        self.assertIn("approval_status", appr)
        self.assertEqual(appr["approval_status"], "CONDITIONAL APPROVAL")

        # 4. Physical Deliverable Generation & OpenXML Verification
        deliverables = res.get("deliverables", [])
        self.assertGreaterEqual(len(deliverables), 4)

        docx_deliv = next((d for d in deliverables if d.get("type") == "DOCX"), None)
        self.assertIsNotNone(docx_deliv, "DOCX deliverable must be generated")
        self.assertTrue(os.path.exists(docx_deliv["file_path"]), "Physical DOCX must exist on disk")
        self.assertGreater(docx_deliv["size_bytes"], 10000, "DOCX size must be realistic")
        self.assertTrue(docx_deliv.get("verified", False), "DOCX must pass OpenXML verification")

        # 5. Verification status
        verif = res.get("verification", {})
        self.assertEqual(verif.get("status"), "VERIFIED")
        self.assertGreaterEqual(len(verif.get("checks", [])), 4)

    # =========================================================================
    # 2. SECONDARY DEMO: CODING WORKFLOW TESTS
    # =========================================================================
    def test_02_secondary_coding_workflow(self):
        """Tests complete 6-step Secondary Demo: Coding request -> Sandbox execution -> Verified PY."""
        req = "Write a Python program to analyze this CSV and calculate maintenance statistics."
        res = orchestrator.execute(req, generate_deliverables=True, verbose=False)

        # 1. Classification & Model Selection
        self.assertEqual(res["task_type"], "CODE_AND_MATH")
        self.assertEqual(res["decision"], "CODE_ANALYSIS")
        self.assertEqual(res["target_role"], "CODING_MODEL")

        # 2. Execution Plan Verification
        plan = res.get("plan", [])
        self.assertEqual(len(plan), 6)
        plan_tools = [p["tool"] for p in plan]
        self.assertIn("model_router", plan_tools)
        self.assertIn("READ_FILE", plan_tools)
        self.assertIn("reasoning_engine", plan_tools)
        self.assertIn("EXECUTE_PYTHON", plan_tools)
        self.assertIn("verify", plan_tools)
        self.assertIn("GENERATE_PY", plan_tools)

        # 3. Sandbox Code Execution Check
        ce = res.get("code_execution")
        self.assertIsNotNone(ce, "code_execution object must be present")
        self.assertEqual(ce.get("status"), "SUCCESS")
        self.assertIn("statistics", ce.get("code", ""))
        self.assertIn("MAINTENANCE STATISTICS", ce.get("stdout", ""))

        # 4. Statistical Metrics Verification
        stats = res.get("observations", {}).get("step_4", {}).get("data", {}).get("variables", {}).get("stats_result") or {}
        self.assertGreaterEqual(stats.get("total_samples", 0), 10)
        self.assertGreater(stats.get("temperature_mean", 0), 60.0)
        self.assertGreaterEqual(stats.get("temperature_std", 0), 0.0)
        self.assertGreater(stats.get("warning_exceedances", 0), 0)

        # 5. Standalone PY Deliverable Verification
        deliverables = res.get("deliverables", [])
        py_deliv = next((d for d in deliverables if d.get("type") == "PY"), None)
        self.assertIsNotNone(py_deliv, "PY deliverable must be generated")
        self.assertTrue(os.path.exists(py_deliv["file_path"]), "Physical PY file must exist on disk")
        self.assertTrue(py_deliv.get("verified", False), "PY file must pass AST syntax verification")

    # =========================================================================
    # 3. BACKEND REST API ENDPOINT INTEGRATION
    # =========================================================================
    def test_03_backend_investigate_killer_workflow(self):
        """Tests /investigate endpoint for the Killer Workflow."""
        payload = {
            "question": "Analyze this inspection report, identify important findings, retrieve the relevant local SOP/manual information, assess the findings using available evidence, and generate an approval note."
        }
        resp = self.client.post("/investigate", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["task_type"], "APPROVAL_NOTE_GENERATION")
        self.assertIsNotNone(data.get("approval_note"))
        self.assertGreaterEqual(len(data.get("deliverables", [])), 4)

    def test_04_backend_investigate_coding_workflow(self):
        """Tests /investigate endpoint for the Secondary Demo coding request."""
        payload = {
            "question": "Write a Python program to analyze this CSV and calculate maintenance statistics."
        }
        resp = self.client.post("/investigate", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["task_type"], "CODE_AND_MATH")
        self.assertIsNotNone(data.get("code_execution"))
        self.assertEqual(data["code_execution"].get("status"), "SUCCESS")

    def test_05_backend_system_status_and_sovereignty(self):
        """Tests /api/system/status and /sovereignty reporting real host hardware and zero egress."""
        status_resp = self.client.get("/api/system/status")
        self.assertEqual(status_resp.status_code, 200)
        s_data = status_resp.get_json()
        self.assertEqual(s_data["status"], "OPERATIONAL")
        self.assertTrue(s_data["air_gapped"])
        self.assertIn("cpu_count", s_data)
        self.assertIn("ram_total_gb", s_data)
        self.assertIn("gpu", s_data)

        sov_resp = self.client.get("/sovereignty")
        self.assertEqual(sov_resp.status_code, 200)
        sov_data = sov_resp.get_json()
        self.assertEqual(sov_data["external_ai_calls"], 0)
        self.assertEqual(sov_data["sovereignty_tier"], "APPLICATION_GUARD_ENFORCED")

    def test_06_backend_deliverables_and_documents(self):
        """Tests /api/deliverables and /api/documents/files catalogs."""
        deliv_resp = self.client.get("/api/deliverables")
        self.assertEqual(deliv_resp.status_code, 200)
        deliv_data = deliv_resp.get_json()
        self.assertGreaterEqual(deliv_data["count"], 1)

        doc_resp = self.client.get("/api/documents/files")
        self.assertEqual(doc_resp.status_code, 200)
        doc_data = doc_resp.get_json()
        self.assertGreaterEqual(doc_data["total_files"], 3)


if __name__ == "__main__":
    unittest.main()
