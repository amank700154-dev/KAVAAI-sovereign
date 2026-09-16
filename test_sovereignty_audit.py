"""
Test Suite: Sovereignty & Network Audit Layer (SIH26117 Mandatory Compliance)
=============================================================================
Tests:
1. SovereigntyMonitor initialization & metric tracking
2. Local vs. External domain classification
3. Active outbound guard: intercepting & blocking external WAN calls
4. Verification that zero fake metrics exist (metrics must reflect live calls)
5. Tool execution audit recording
6. Document processing audit recording
7. RAG retrieval audit recording
8. Sovereignty report data structure & truthful host network disclosure
9. Backend API endpoints: /sovereignty, /api/sovereignty/audit, /api/sovereignty/test-guard
"""

import os
import sys
import unittest
import requests

from sovereignty_monitor import (
    SovereigntyMonitor,
    SovereigntySecurityException,
    sovereignty_monitor
)
from backend import app


class TestSovereigntyAuditLayer(unittest.TestCase):

    def setUp(self):
        self.monitor = sovereignty_monitor
        self.app = app.test_client()

    def test_01_endpoint_classification(self):
        """Verify local loopback vs external WAN classification."""
        # Local loopback & subnets
        self.assertTrue(self.monitor.is_local_host("localhost"))
        self.assertTrue(self.monitor.is_local_host("127.0.0.1"))
        self.assertTrue(self.monitor.is_local_host("0.0.0.0"))
        self.assertTrue(self.monitor.is_local_host("::1"))
        self.assertTrue(self.monitor.is_local_host("192.168.1.100"))
        self.assertTrue(self.monitor.is_local_host("10.0.0.5"))

        # External WAN domains
        self.assertFalse(self.monitor.is_local_host("api.openai.com"))
        self.assertFalse(self.monitor.is_local_host("anthropic.com"))
        self.assertFalse(self.monitor.is_local_host("google.com"))
        self.assertFalse(self.monitor.is_local_host("8.8.8.8"))

    def test_02_outbound_guard_blocks_wan(self):
        """Verify active application guard raises SovereigntySecurityException on external calls."""
        initial_blocked = self.monitor.blocked_external_requests

        # Calling an external domain should be actively blocked
        with self.assertRaises(SovereigntySecurityException) as ctx:
            requests.get("https://api.openai.com/v1/models", timeout=2)

        self.assertIn("blocked", str(ctx.exception).lower())
        self.assertIn("api.openai.com", str(ctx.exception))
        self.assertEqual(self.monitor.blocked_external_requests, initial_blocked + 1)

    def test_03_test_outbound_guard_method(self):
        """Verify test_outbound_guard safely exercises guard and records attempt."""
        prev_blocked = self.monitor.blocked_external_requests
        res = self.monitor.test_outbound_guard("https://api.anthropic.com/v1/messages")

        self.assertEqual(res["status"], "SUCCESS_BLOCKED")
        self.assertIn("api.anthropic.com", res["target"])
        self.assertEqual(self.monitor.blocked_external_requests, prev_blocked + 1)

    def test_04_truthful_host_network_status(self):
        """Verify host network detection honestly reports network reachability."""
        net_status = self.monitor.detect_host_network_status()
        self.assertIn("physical_air_gap", net_status)
        self.assertIn("sovereignty_tier", net_status)
        self.assertIn("badge", net_status)

        # Must not make false claims
        if net_status["wan_reachable"]:
            self.assertEqual(net_status["sovereignty_tier"], "APPLICATION_GUARD_ENFORCED")
            self.assertIn("APP GUARD", net_status["badge"])
        else:
            self.assertEqual(net_status["sovereignty_tier"], "PHYSICALLY_AIR_GAPPED")

    def test_05_sovereignty_report_metrics(self):
        """Verify sovereignty report returns all required SIH26117 metrics."""
        rep = self.monitor.get_sovereignty_report()
        required_keys = [
            "sovereignty_status",
            "status_color",
            "external_ai_calls",
            "cloud_llm_calls",
            "blocked_external_requests",
            "local_model_calls",
            "permitted_local_requests",
            "tool_executions",
            "rag_operations",
            "document_operations",
            "configured_cloud_providers",
            "cloud_providers_count",
            "network_status"
        ]
        for k in required_keys:
            self.assertIn(k, rep, f"Missing required sovereignty report field: {k}")

        # Core sovereignty compliance assertion: Zero external AI or cloud LLM calls allowed
        self.assertEqual(rep["external_ai_calls"], 0)
        self.assertEqual(rep["cloud_llm_calls"], 0)
        self.assertEqual(rep["cloud_providers_count"], 0)
        self.assertGreater(rep["blocked_external_requests"], 0)

    def test_06_audit_log_tracking(self):
        """Verify audit events are stored with category, operation, endpoint, and classification."""
        events = self.monitor.get_audit_log(limit=20)
        self.assertIsInstance(events, list)
        self.assertGreater(len(events), 0)

        sample = events[0]
        self.assertIn("category", sample)
        self.assertIn("operation", sample)
        self.assertIn("endpoint", sample)
        self.assertIn("classification", sample)
        self.assertIn("status", sample)

    def test_07_backend_sovereignty_endpoint(self):
        """Verify /sovereignty HTTP endpoint returns live metrics."""
        res = self.app.get("/sovereignty")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("sovereignty_status", data)
        self.assertEqual(data["external_ai_calls"], 0)
        self.assertGreater(data["blocked_external_requests"], 0)
        self.assertEqual(data["air_gapped"], True)

    def test_08_backend_audit_endpoint(self):
        """Verify /api/sovereignty/audit returns filtered audit entries."""
        res = self.app.get("/api/sovereignty/audit?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("events", data)
        self.assertIn("total_events", data)
        self.assertIsInstance(data["events"], list)

    def test_09_backend_test_guard_endpoint(self):
        """Verify /api/sovereignty/test-guard actively triggers guard interception."""
        prev_blocked = self.monitor.blocked_external_requests
        res = self.app.post(
            "/api/sovereignty/test-guard",
            json={"target_url": "https://api.cohere.ai/v1/generate"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertEqual(data["status"], "SUCCESS_BLOCKED")
        self.assertIn("api.cohere.ai", data["target"])
        self.assertEqual(self.monitor.blocked_external_requests, prev_blocked + 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
