# KAVAAI SOVEREIGN
### Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work
**SIH26117 — Smart India Hackathon**

---

## 🏭 What is KAVAAI Sovereign?

**KAVAAI Sovereign** is an industrial AI workstation engineered for confidential manufacturing, energy, and defense plants.

### 🛡️ Core Sovereignty Guarantee
- **100% On-Premise Execution**: All reasoning, coding, vision analysis, embeddings, and document generation occur strictly on your local machine (`127.0.0.1`).
- **Application-Level Outbound Guard**: Intercepts socket and HTTP calls at runtime. Any unauthorized external WAN communication (e.g. calls to cloud APIs) is blocked immediately.
- **Zero Confidential Data Egress**: No factory manuals, telemetry logs, or inspection photos ever leave the facility.

---

## 📂 Project Architecture

The codebase is organized into clear, beginner-friendly modules:

```
KAVAAI-Sovereign/
│
├── backend/                      # Python API & Agentic AI Backend
│   ├── main.py                   # [ENTRY POINT] Flask API server & static UI host
│   ├── config/                   # Centralized configuration & settings
│   │   └── settings.py
│   ├── agent/                    # Agentic AI orchestration & model routing
│   │   ├── orchestrator.py       # Main autonomous planner & self-healing loop
│   │   └── router.py             # Model role mapping & local Ollama dispatch
│   ├── tools/                    # 12 Safe local registered tools
│   │   ├── registry.py           # Tool catalog & BaseTool execution
│   │   └── legacy_adapters.py    # Compatibility wrappers
│   ├── sandbox/                  # Isolated Python code execution
│   │   ├── security.py           # AST code validator & path containment
│   │   └── executor.py           # AST sandbox with safe builtins
│   ├── rag/                      # Retrieval-Augmented Generation (Local)
│   │   ├── knowledge_connector.py# ChromaDB semantic search & retrieval
│   │   └── indexer.py            # Document chunking & database seeding
│   ├── multimodal/               # Document intelligence & vision
│   │   └── document_intelligence.py # PDF parsing, local OCR, vision
│   ├── documents/                # Real deliverable generation & verification
│   │   └── deliverable_generator.py # DOCX, XLSX, PPTX, CSV, TXT, PY
│   └── security/                 # Air-gap governance & audit trail
│       └── sovereignty_monitor.py# Outbound socket guard & JSONL logger
│
├── frontend/                     # Industrial AI Workbench UI
│   ├── index.html                # 8-view mission-critical interface
│   ├── app.js                    # UI logic, telemetry polling, API client
│   ├── style.css                 # Dark industrial cybernetic styling
│   └── streamlit_app.py          # Alternative Streamlit dashboard
│
├── data/                         # Confidential Data Storage
│   ├── knowledge_base/           # Local SOPs, manuals, inspection reports
│   ├── sample/                   # Sample equipment photos & telemetry CSVs
│   └── vector_store/             # ChromaDB persistent local database
│
├── workspace/
│   └── output/                   # Generated deliverables & audit logs
│
├── tests/                        # Automated Unit & Integration Test Suites
│   ├── test_tool_system.py       # 13 tests: Safe tools & AST sandbox
│   ├── test_sovereignty_audit.py # 7 tests: Air-gap guard & audit log
│   ├── test_deliverable_generation.py # 10 tests: OpenXML deliverable formats
│   └── test_end_to_end_integration.py # 6 tests: Killer Workflow & Secondary Demo
│
├── scripts/                      # Standalone CLI utilities & prototypes
│   ├── cli_investigate.py        # CLI agent runner for headless execution
│   ├── test_vision_cli.py        # Standalone vision test
│   └── test_rag_cli.py           # Standalone vector search test
│
├── docs/                         # Comprehensive Architecture Guides
│   └── architecture/
│       ├── CODE_MAP.md           # Beginner's complete guide to the codebase
│       ├── REQUEST_FLOW.md       # Step-by-step trace of a real request
│       └── DEPENDENCY_MAP.md     # Architectural layers & import hierarchy
│
├── .env.example                  # Environment variables template
├── model_config.json             # Local model roles configuration
├── requirements.txt              # Python library dependencies
└── README.md                     # You are here!
```

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Python 3.10+** installed.
2. (Optional for live LLM inference) **Ollama** installed with local models:
   ```bash
   ollama pull qwen2.5:7b
   ollama pull qwen2.5vl:7b
   ```
   *(Note: If Ollama is offline, the system automatically uses its built-in local deterministic rule fallback without crashing!)*

### Step 1: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 2: Start the Backend & Workbench
```powershell
python backend/main.py
```
This boots the local Flask API and serves the frontend.

### Step 3: Open the Industrial Workbench
Open your browser and navigate to:
```
http://127.0.0.1:8000/
```

---

## ⚡ Primary Demonstrations

### 1. The Killer Workflow (Scanned Report → Verified Approval Note)
1. In the **Agent Workspace**, click the prompt chip:
   > *"Analyze this inspection report, identify important findings, retrieve the relevant local SOP/manual information, assess the findings using available evidence, and generate an approval note."*
2. Click **INVESTIGATE**.
3. **What happens under the hood**:
   - The document intelligence engine parses the inspection report and runs local OCR.
   - The multimodal engine examines the radiator fin dust coverage in the equipment image.
   - The knowledge connector retrieves the thermal limits from `SOP-042` via ChromaDB.
   - The agent correlates the findings (84.2°C exceeds 80°C warning baseline) and determines `CONDITIONAL APPROVAL`.
   - Generates and verifies a real Microsoft Word (`.docx`) Approval Note, `.xlsx` audit spreadsheet, `.txt` report, and `.csv` telemetry log.

### 2. The Secondary Demo (Code Lab & Self-Healing Statistics)
1. Click the button:
   > **⚡ SECONDARY DEMO: WRITE PYTHON PROGRAM & ANALYZE CSV STATISTICS**
2. Click **INVESTIGATE**.
3. **What happens under the hood**:
   - The Model Router selects the local `CODING_MODEL` (`qwen2.5:7b`).
   - The agent loads 30 days of operational telemetry from `machine101_maintenance_history.csv`.
   - Synthesizes a Python statistical script and runs it in the AST isolated sandbox.
   - Executes automated assertions and generates a verified standalone `.py` script and summary `.csv`.

---

## 🧪 Running Automated Tests

Run the complete 36-test suite covering sandbox security, air-gap sovereignty, deliverable generation, and end-to-end integration:

```powershell
python -m unittest discover -s tests
```

---

## 📖 Beginner's Learning Path

Want to learn how this codebase works? Read the architecture guides in `docs/architecture/`:
1. [CODE_MAP.md](file:///docs/architecture/CODE_MAP.md) — Comprehensive guide explaining every file and folder in plain English.
2. [REQUEST_FLOW.md](file:///docs/architecture/REQUEST_FLOW.md) — Step-by-step trace of a request through the system.
3. [DEPENDENCY_MAP.md](file:///docs/architecture/DEPENDENCY_MAP.md) — Architectural layers and import relationships.
