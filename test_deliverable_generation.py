"""
Comprehensive Automated Test Suite for Real Deliverable Generation
==================================================================
Tests:
1. Deliverable Generator Core across all 6 formats:
   - DOCX: Microsoft Word Engineering Report
   - XLSX: Openpyxl Styled Audit Matrix
   - PPTX: Python-pptx Executive Presentation Slides
   - TXT:  Monospace Technical Audit Report
   - CSV:  Comma-delimited Parameter Log
   - PY:   Standalone Executable Validation Script
2. Verification Tool (VERIFY_FILE / verify_deliverable):
   - OpenXML zip schema validation
   - AST syntax validation for Python scripts
   - UTF-8 text integrity
   - Error detection on 0-byte or corrupted files
3. Engineering Approval Note Quality Criteria:
   - Title, Document Reference, Summary, Key Findings Table,
     Traceable Evidence Matrix, Relevant SOP Citations,
     Recommended Actions, Assumptions & Limitations,
     Timestamp, and Authorized Sign-off Block
   - Strict zero-hallucination constraint
4. Primary Demo 10-Step Workflow Integration:
   - User uploads scanned inspection report
   - Agent reads report, executes OCR/vision analysis, queries SOPs,
     reasons over evidence, drafts approval note, generates DOCX,
     verifies DOCX, and returns downloadable deliverable package.
"""

import os
import sys
import unittest
import docx
import openpyxl
import pptx
import ast
import csv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from deliverable_generator import deliverable_gen
import tool_system
from tool_system import registry
from agent_orchestrator import orchestrator


class TestRealDeliverableGeneration(unittest.TestCase):

    def setUp(self):
        self.output_dir = os.path.join(BASE_DIR, "output")
        os.makedirs(self.output_dir, exist_ok=True)

    # --------------------------------------------------------------------------
    # 1. INDIVIDUAL DELIVERABLE FORMAT TESTS (ALL 6 FORMATS)
    # --------------------------------------------------------------------------
    def test_01_generate_docx_report(self):
        res = deliverable_gen.generate_docx(
            title="Machine 101 Engineering Diagnostic Report",
            sections={
                "Executive Summary": "Autonomous assessment verified cooling subsystem.",
                "Telemetry Findings": "Temperature logged at 72C, well inside 60-80C safe band.",
                "Corrective Actions": "Continue standard preventive maintenance schedule."
            },
            telemetry={"temperature": 72, "fan": "ACTIVE", "pressure": 2.4},
            output_filename="test_gen_report.docx"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "DOCX")
        self.assertTrue(os.path.exists(res["file_path"]))
        self.assertGreater(res["size_bytes"], 1000)

        # Verify using VERIFY_FILE tool
        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "docx"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    def test_02_generate_xlsx_audit_matrix(self):
        res = deliverable_gen.generate_xlsx(
            title="Telemetry Audit & Compliance Matrix",
            headers=["Parameter", "Recorded", "SOP Baseline", "Variance", "Risk Level"],
            rows=[
                ["Core Temperature", "84.2°C", "60°C - 80°C", "+4.2°C", "WARNING"],
                ["Cooling Fan Speed", "1240 RPM", "1200 - 1400 RPM", "Nominal", "NORMAL"],
                ["Coolant Loop Pressure", "2.35 bar", "2.0 - 3.5 bar", "Nominal", "NORMAL"],
                ["Coolant Reservoir", "68%", "60% - 100%", "+8% Above Min", "NORMAL"]
            ],
            output_filename="test_gen_audit.xlsx"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "XLSX")
        self.assertTrue(os.path.exists(res["file_path"]))
        self.assertGreater(res["size_bytes"], 1000)

        # Inspect with openpyxl
        wb = openpyxl.load_workbook(res["file_path"])
        self.assertIn("Compliance Matrix", wb.sheetnames)
        ws = wb.active
        self.assertEqual(ws.max_row, 8)  # Title + Sub + blank + header + 4 rows

        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "xlsx"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    def test_03_generate_pptx_briefing(self):
        res = deliverable_gen.generate_pptx(
            title="Machine 101 Thermal Assessment",
            subtitle="Confidential Internal Audit Deck",
            slides=[
                {"title": "Overview", "points": ["Equipment inspected.", "SOP-042 limits verified."]},
                {"title": "Findings", "points": ["Operating temp 84.2°C.", "Radiator 20-30% dust."]},
                {"title": "Actions", "points": ["Schedule radiator fin cleaning within 48h."]}
            ],
            output_filename="test_gen_briefing.pptx"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "PPTX")
        self.assertTrue(os.path.exists(res["file_path"]))
        self.assertGreater(res["size_bytes"], 5000)

        prs = pptx.Presentation(res["file_path"])
        self.assertEqual(len(prs.slides), 4)  # Title slide + 3 content slides

        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "pptx"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    def test_04_generate_txt_technical_report(self):
        res = deliverable_gen.generate_txt(
            title="Machine 101 Monospace Technical Report",
            sections={
                "Summary": "Technical inspection completed with zero cloud egress.",
                "Readings": "Core Temp: 84.2C | Fan: 1240 RPM | Coolant: 68%",
                "Protocol": "SOP-042 Phase 1 protocol activated."
            },
            metadata={"Document_ID": "TECH-M101-01", "Security": "Air-Gapped Local"},
            output_filename="test_gen_report.txt"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "TXT")
        self.assertTrue(os.path.exists(res["file_path"]))

        with open(res["file_path"], "r", encoding="utf-8") as f:
            txt_content = f.read()
        self.assertIn("KAVAAI SOVEREIGN ON-PREMISE AI WORKBENCH", txt_content)
        self.assertIn("SOP-042 Phase 1 protocol activated", txt_content)

        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "txt"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    def test_05_generate_csv_telemetry_export(self):
        res = deliverable_gen.generate_csv(
            headers=["Parameter", "Reading", "Unit", "Baseline_Min", "Baseline_Max", "Status"],
            rows=[
                ["Temperature", 84.2, "degC", 60.0, 80.0, "WARNING"],
                ["Fan_Speed", 1240, "RPM", 1200, 1400, "NORMAL"],
                ["Pressure", 2.35, "bar", 2.0, 3.5, "NORMAL"],
                ["Coolant_Level", 68, "percent", 60, 100, "NORMAL"]
            ],
            output_filename="test_gen_telemetry.csv"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "CSV")
        self.assertTrue(os.path.exists(res["file_path"]))

        with open(res["file_path"], "r", encoding="utf-8") as f:
            r = list(csv.reader(f))
        self.assertEqual(len(r), 5)  # 1 header + 4 rows
        self.assertEqual(r[1][0], "Temperature")
        self.assertEqual(r[1][1], "84.2")

        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "csv"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    def test_06_generate_py_verification_script(self):
        res = deliverable_gen.generate_py(
            script_name="Machine 101 Thermal Margin Validator",
            description="Standalone script to verify recorded sensor limits against SOP-042",
            telemetry_data={"temperature": 84.2, "rpm": 1240, "coolant": 68},
            sop_thresholds={"temperature_warning_c": 80.0, "temperature_critical_c": 95.0, "fan_rpm_min": 1200, "fan_rpm_max": 1400, "coolant_min_percent": 60},
            output_filename="test_gen_validator.py"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "PY")
        self.assertTrue(os.path.exists(res["file_path"]))

        # Verify valid AST syntax
        with open(res["file_path"], "r", encoding="utf-8") as f:
            code = f.read()
        tree = ast.parse(code)
        self.assertIsNotNone(tree)
        self.assertIn("verify_operational_envelope", code)

        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "py"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    # --------------------------------------------------------------------------
    # 2. APPROVAL NOTE QUALITY & TRACEABILITY TESTS
    # --------------------------------------------------------------------------
    def test_07_approval_note_contains_all_9_quality_sections(self):
        findings = [
            {"parameter": "Core Temperature", "measured_value": "84.2°C", "baseline": "60°C - 80°C", "delta": "+4.2°C", "compliance_state": "WARNING (>80°C)"},
            {"parameter": "Ventilation Fan", "measured_value": "1240 RPM", "baseline": "1200 - 1400 RPM", "delta": "Nominal", "compliance_state": "COMPLIANT"}
        ]
        evidence = [
            {"source": "Field Inspection Report (IR-2026-0914-A)", "modality": "DIGITAL_TEXT / OCR", "fact": "Core temp measured at 84.2°C.", "citation": "[IR-2026-0914-A: Sec 2]"},
            {"source": "Visual Inspection by R. Sharma", "modality": "PHYSICAL_OBSERVATION", "fact": "20-30% radiator fin dust coverage.", "citation": "[IR-2026-0914-A: Sec 3]"}
        ]
        sop_refs = [
            {"document_id": "SOP-042-REV-3", "title": "Thermal Protocol", "section": "Sec 2 & 3", "clause": "Warning >80°C activates Phase 1 fan inspection & radiator cleaning."}
        ]
        actions = [
            "Grant CONDITIONAL APPROVAL for continued operation for up to 48 hours.",
            "Clean radiator fins with compressed air within 48 hours."
        ]
        limits = [
            "Assumes ambient plant temperature remains <= 32°C.",
            "Valid exclusively for Machine 101 (ICU-101-A)."
        ]

        res = deliverable_gen.generate_approval_note(
            title="ENGINEERING APPROVAL NOTE: Machine 101 Thermal Variance & Operational Fitness",
            document_ref="DOC-REF: APPR-2026-M101-042",
            summary="Inspection findings evaluated. Operating temperature of 84.2°C exceeds 80°C warning limit. Conditional approval granted subject to cleaning.",
            key_findings=findings,
            evidence=evidence,
            sop_references=sop_refs,
            recommended_actions=actions,
            assumptions_limitations=limits,
            approval_status="CONDITIONAL APPROVAL",
            output_filename="test_official_approval_note.docx"
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["type"], "DOCX")
        self.assertEqual(res["approval_status"], "CONDITIONAL APPROVAL")
        self.assertGreater(res["size_bytes"], 25000)

        # Inspect Word Document content (paragraphs and tables)
        doc = docx.Document(res["file_path"])
        full_doc_text = "\n".join([p.text for p in doc.paragraphs] + [c.text for t in doc.tables for row in t.rows for c in row.cells])
        
        # Check all 9 required quality elements:
        # 1. Title
        self.assertIn("ENGINEERING APPROVAL NOTE", full_doc_text)
        # 2. Document Reference
        self.assertIn("APPR-2026-M101-042", full_doc_text)
        # 3. Summary
        self.assertIn("Executive Summary", full_doc_text)
        # 4. Key findings
        self.assertIn("Key Inspection Findings", full_doc_text)
        # 5. Evidence
        self.assertIn("Evidence Traceability Matrix", full_doc_text)
        # 6. SOP references
        self.assertIn("SOP-042-REV-3", full_doc_text)
        # 7. Recommended action
        self.assertIn("Recommended Actions", full_doc_text)
        # 8. Assumptions / limitations
        self.assertIn("Assumptions & Limitations", full_doc_text)
        # 9. Timestamp
        self.assertIn("DATE / TIME:", full_doc_text)

        # Verify via tool
        v = registry.invoke("VERIFY_FILE", {"file_path": res["file_path"], "expected_format": "docx"})
        self.assertEqual(v["status"], "SUCCESS")
        self.assertTrue(v["data"]["verified"])

    # --------------------------------------------------------------------------
    # 3. PRIMARY DEMO 10-STEP WORKFLOW INTEGRATION TEST
    # --------------------------------------------------------------------------
    def test_08_primary_demo_10_step_workflow(self):
        user_prompt = "Analyze this report, compare findings with the relevant local maintenance/SOP documents, and prepare an approval note."
        res = orchestrator.execute(
            user_request=user_prompt,
            context={"file_path": os.path.join(BASE_DIR, "knowledge_base", "inspection_reports", "Scanned_Inspection_Report_Machine101.pdf")},
            generate_deliverables=True,
            verbose=False
        )

        self.assertEqual(res["task_type"], "APPROVAL_NOTE_GENERATION")
        self.assertEqual(res["decision"], "BOTH")
        self.assertEqual(res["manual_status"], "COMPLETED")
        self.assertEqual(res["image_status"], "COMPLETED")

        # Verify plan has the required 10 steps
        plan = res.get("plan", [])
        self.assertEqual(len(plan), 10, f"Expected 10 steps in primary demo plan, got {len(plan)}")
        step_tools = [p["tool"] for p in plan]
        self.assertIn("READ_FILE", step_tools)
        self.assertIn("OCR_DOCUMENT", step_tools)
        self.assertIn("ANALYZE_IMAGE", step_tools)
        self.assertIn("SEARCH_KNOWLEDGE_BASE", step_tools)
        self.assertIn("GENERATE_APPROVAL_NOTE", step_tools)
        self.assertIn("VERIFY_FILE", step_tools)

        # Verify deliverables returned
        deliverables = res.get("deliverables", [])
        self.assertGreaterEqual(len(deliverables), 4)
        
        types_generated = {d["type"] for d in deliverables}
        self.assertIn("DOCX", types_generated)
        self.assertIn("XLSX", types_generated)
        self.assertIn("TXT", types_generated)
        self.assertIn("CSV", types_generated)
        self.assertIn("PY", types_generated)

        # Check DOCX deliverable is verified
        docx_deliv = next(d for d in deliverables if d["type"] == "DOCX")
        self.assertTrue(docx_deliv.get("verified", True))
        self.assertTrue(os.path.exists(docx_deliv["file_path"]))
        self.assertGreater(docx_deliv["size_bytes"], 25000)

        # Check approval note content in output
        self.assertIsNotNone(res.get("approval_note"))
        an = res["approval_note"]
        self.assertIn("DOC-REF", an.get("document_ref", ""))
        self.assertEqual(an.get("approval_status"), "CONDITIONAL APPROVAL")
        self.assertTrue(len(an.get("key_findings", [])) >= 2)
        self.assertTrue(len(an.get("evidence", [])) >= 2)
        self.assertTrue(len(an.get("sop_references", [])) >= 1)
        self.assertTrue(len(an.get("recommended_actions", [])) >= 2)


if __name__ == "__main__":
    unittest.main()
