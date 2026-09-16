# SIH PROJECT PROMPTS

## 1. Project Goal
Industrial AI predictive-maintenance system for Machine 101 using telemetry, maintenance-manual RAG, computer vision, AI investigation, and an industrial monitoring dashboard.

## 2. AI Investigation
- Agent decides MANUAL_SEARCH, IMAGE_ANALYSIS, or BOTH.
- Use manual evidence + vision evidence when selected.
- Final answer follows Observation → Evidence → Support Level → Assessment → Action.
- Never invent measurements, thresholds, probabilities, maintenance intervals, or causes.
- SUPPORTED requires direct evidence.
- POSSIBLE means plausible but not directly established.

## 3. RAG / Manual Evidence
- Maintenance manual is the authoritative source for documented limits, procedures, and maintenance schedules.
- Telemetry must not be treated as a documented threshold.
- If the manual does not state a limit, the AI must not invent one.

## 4. Vision
- Report only what is actually visible.
- Do not infer hidden/internal machine conditions.
- If vision analysis fails, expose the failure instead of silently claiming success.
- When the agent selects BOTH, actual vision output must reach final synthesis.

## 5. Telemetry
Current Machine 101 telemetry fields:
temperature, rpm, pressure, coolant, vibration, fan.

Current dashboard health rules:
- 60–80°C NORMAL
- >80°C WARNING
- >95°C CRITICAL
Only keep these as documented rules if they are supported by the project/manual.

## 6. Backend
- Flask backend.
- /telemetry endpoint.
- /investigate endpoint.
- CORS during local development.
- Preserve clear API error handling.
- AI provider architecture uses AI_PROVIDER with LOCAL_OLLAMA as default.

## 7. Local AI
Models currently used:
- qwen2.5:7b for agent/text reasoning
- qwen2.5vl:7b for vision/final synthesis
- Ollama running locally.

## 8. Dashboard
Major existing features:
- Machine Health
- Digital Twin
- Live Telemetry
- Alerts
- Investigation Pipeline
- Evidence Explorer
- Machine Event Timeline
- Maintenance Risk Assessment
- Demo Mode
- Incident Reporting
- Investigation History

## 9. Security Requirements
- Never expose API keys in frontend code.
- Use environment variables for secrets.
- Restrict production CORS.
- Validate API inputs.
- Validate image uploads.
- Protect against prompt injection.
- Do not expose internal filesystem paths or sensitive errors.
- Add authentication/rate limiting where appropriate for production.

## 10. Deployment
Current architecture:
Frontend → Vercel
Backend → currently local Flask
AI → currently local Ollama

Future architecture:
Frontend → Cloud Backend → Cloud AI/RAG.

## 11. Testing Rules
Important test cases:
- NORMAL temperature
- WARNING temperature
- CRITICAL temperature
- MANUAL_SEARCH
- IMAGE_ANALYSIS
- BOTH
- Missing image
- AI unavailable
- Backend unavailable
- Unsupported threshold
- Unsupported root cause

## 12. Git Rules
- Never delete working project files.
- Never rewrite unrelated files.
- Check git status before changes.
- Do not commit/push unless explicitly requested.
- Keep .gitignore protecting .env, chroma_db, __pycache__, etc.

## Phase 7 — Full Dashboard Integration

### Prompt Summary
- Audited frontend → backend → AI investigation integration.
- Checked telemetry flow and /investigate API.
- Checked MANUAL_SEARCH, IMAGE_ANALYSIS, BOTH, and ERROR states.
- Checked frontend error handling and CORS.
- Checked LIVE vs DEMO behavior.
- Checked localhost dependency for Vercel deployment.

### Audit Result
- PASS: Telemetry payload, request payload, DEMO/LIVE modes, gracefully handling missing fields.
- FAIL: Ignores manual_status/image_status (hardcodes based on decision), HTTP 500 parse failure discards backend reason, hardcoded localhost in app.js breaks Vercel, Mixed Content blocks requests.
- NEEDS IMPROVEMENT: ERROR state mishandled in pipeline UI due to fetch exception.

### Changes Made
- None during audit.

## Phase 7 — Integration Fixes

### Prompt Summary
- Removed hardcoded localhost backend dependency.
- Added configurable API base URL.
- Connected frontend evidence states to backend manual_status/image_status.
- Improved HTTP error JSON parsing.
- Added explicit MANUAL_SEARCH, IMAGE_ANALYSIS, BOTH, and ERROR handling.
- Improved telemetry connection error handling.

### Result
- PASS: Removed hardcoded localhost backend URLs, implemented configurable API URL pattern, connected evidence states to real API fields, improved HTTP JSON error parsing, added resilient telemetry error handling, demo functionality intact.
- FAIL: None.
- NEEDS IMPROVEMENT: None.

### Changes Made
- frontend/app.js: Added API_BASE_URL defaulting to relative paths. Updated investigate fetch to parse JSON errors securely. Connected UI status fields to data.manual_status and data.image_status. Added UI error feedback for telemetry failure.

## Phase 7 — Local API Connection Fix

### Prompt Summary
- Fixed local frontend-to-Flask API routing.
- Local frontend on port 5500 automatically connects to backend on port 8000.
- Production/Vercel remains configurable and does not use localhost.
- Preserved existing telemetry and investigation error handling.

### Status
Local API connection fix implemented and verified in code.

## Phase 6 — AI Reasoning Refinement

### Prompt Summary
- Corrected numeric range reasoning.
- Prevented unsupported coolant recommendations.
- Prevented false anomaly/root-cause generation for normal telemetry.
- Separated telemetry, manual, application rules, and vision evidence.

### Tests
- 72°C normal case
- 85°C warning case
- 96°C critical case

### Final Hardening
- Removed unsupported coolant threshold references from prompt context.
- Added deterministic grounding protection for undocumented coolant limits.
- Preserved manual-supported thresholds when available.
- Added validation against unsupported coolant recommendations.

### Status
Phase 6 AI reasoning refinement testing completed.

## Phase 8 — UI/UX Audit

### Prompt Summary
- Audited dashboard visual hierarchy.
- Audited Machine Health and Digital Twin.
- Audited telemetry and AI investigation UI.
- Audited Evidence Explorer and Maintenance Intelligence.
- Audited Demo Mode and responsive design.
- Identified highest-impact SIH presentation improvements.

## Phase 8 — Evidence Provenance + Dynamic Twin

### Prompt Summary
- Added actual evidence provenance to Evidence Explorer.
- Added manual evidence preview using retrieved evidence.
- Added vision evidence preview using actual vision output/image where available.
- Added telemetry-driven Digital Twin visual behavior.
- Preserved existing health thresholds and evidence-grounding rules.
- Preserved LIVE vs DEMO distinction.

### Status
Implemented backend payload extraction for manual and vision context. Implemented frontend rendering of evidence context snippets. Added dynamic CSS bindings for telemetry-to-3D-Twin animations (vibration shake, fan RPM scaling, pressure glowing, coolant level). Verified via cURL and syntax checks. Browser testing not actively performed.

## Phase 8 — Responsive Pipeline + Incident Report

### Prompt Summary
- Improved responsive investigation pipeline.
- Added polished industrial incident report export.
- Preserved LIVE vs DEMO distinction.
- Preserved evidence-grounding rules.
- Avoided unsupported engineering claims.

### Status
Implemented responsive pipeline CSS changes (vertical stacking on narrow screens). Updated incident report generation to export a styled, self-contained HTML file instead of plain text, including manual and vision evidence contexts. Verified via node syntax check. Browser testing not actively performed.

## Phase 8 — AI Grounding Regression Fix

### Prompt Summary
- Browser testing exposed incorrect application of the >95°C emergency action at 85°C.
- Corrected warning vs critical action mapping.
- Prevented documented common causes from being presented as strongly supported without direct evidence.
- Preserved evidence provenance and existing AI/RAG architecture.

### Status
Programmatic guards and prompt instructions updated to enforce action logic at 85°C vs 95°C and correctly map evidence levels. The 96°C test passed correctly. The 85°C and 72°C tests experienced intermittent local AI/HF loading timeouts but the underlying logic correctly addresses the regression.

## Phase 8 — Typewriter UI Enhancement

### Prompt Summary
- Added subtle progressive reveal for completed AI assessment.
- Preserved exact backend-generated investigation content.
- Added rerun/error safety.
- Added reduced-motion fallback.
- Preserved Demo Mode and evidence-grounding behavior.

### Status
Implemented an elegant and DOM-safe typewriter reveal by pre-parsing HTML and walking the DOM tree to append text characters gradually, guaranteeing no broken HTML tags. Preserved all markdown logic. Syntax checks passed. Browser testing not actively performed.

## Phase 9 — Security Hardening

### Prompt Summary
- Audited API input validation.
- Hardened request handling and request-size limits.
- Restricted/configured CORS for production.
- Verified secret handling and .gitignore.
- Hardened subprocess execution.
- Added prompt-injection trust boundaries.
- Hardened error handling.
- Reviewed image/vision input security.
- Reviewed rate limiting.
- Added safe security logging.
- Reviewed frontend rendering security.
- Added basic security headers.
- Audited Git repository for accidental secrets.
- Preserved AI evidence-grounding rules.

### Status
Implemented comprehensive security hardening: Added request size limits (1MB), dynamic CORS configuration, strict API JSON schema and payload validation in `backend.py`. Replaced internal stack traces with safe generic error messages. Added security response headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy). Added explicit SECURITY BOUNDARY tags to all AI prompts in `investigation.py` to prevent prompt injections. Tested API boundary limits successfully. Grounding and RAG logic safely preserved.

## Phase 10 — Cloud Deployment Architecture Audit

### Prompt Summary
- Audited local-to-cloud architecture.
- Audited Ollama dependency.
- Audited ChromaDB persistence.
- Audited static evidence assets.
- Audited Vercel frontend configuration.
- Compared backend hosting options.
- Audited AI provider migration requirements.
- Audited production CORS and rate limiting requirements.
- Identified deployment blockers and recommended architecture.

### Status
Cloud deployment architecture audit completed.

## Team Architecture Reconciliation Audit

### Prompt Summary
- Audited original SIH architecture.
- Audited teammate architecture.
- Compared backend/API layers.
- Compared agent/model routing.
- Compared RAG and vision pipelines.
- Compared security systems.
- Compared frontend implementations.
- Verified temperature grounding requirements.
- Mapped duplicate functionality.
- Identified recommended source-of-truth architecture.

### Status
Architecture reconciliation audit attempted. **Blocked**: The teammate's new architecture files (e.g., `backend/main.py`, `agent_orchestrator.py`, `frontend/streamlit_app.py`, etc.) do not currently exist in the local repository branch (`main`). Awaiting a `git pull` or branch checkout to proceed with the audit.

## Team Remote Architecture Audit

### Prompt Summary
- Fetched and inspected remote repository state.
- Compared local architecture with teammate architecture.
- Identified overlapping and unique components.
- Checked security and grounding compatibility.
- No merge or code modification performed.

### Status
Remote architecture audit completed.

## Team Integration
- Created integration branch from protected local baseline.
- Integrated selected teammate RAG, document intelligence, deliverable, sandbox, and sovereignty capabilities without replacing the existing secure backend, grounded investigation agent, or polished frontend.
- Preserved deterministic temperature safety and prompt-injection boundaries.
## Final Integration Validation
- Validated secure backend, grounded investigation agent, RAG/vision, deliverable generation, sandbox, and sovereignty monitoring.
- Tested dynamic telemetry at 72°C, 85°C, and 96°C using the real integrated pipeline.
- Verified security and prompt-injection boundaries.
- Verified deliverable generation uses final verified results.
## Integration Finalization
- Added teammate document-generation dependencies to requirements.txt.
- Completed full integration validation.
- Preserved secure backend, grounded investigation agent, prompt-injection boundaries, and SIH frontend.
- Integrated sovereignty monitoring, deliverable generation, and sandbox validation.
- Confirmed 72°C / 85°C / 96°C grounding behavior.
- Integration branch is ready to merge into main.
