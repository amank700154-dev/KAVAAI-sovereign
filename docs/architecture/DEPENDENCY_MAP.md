# KAVAAI Sovereign — Architectural Dependency Map

This document illustrates the module hierarchy, import relationships, and architectural layering of the **KAVAAI Sovereign** system.

---

## 1. High-Level Architectural Layers

The system follows a strict, unidirectional dependency hierarchy:

```
[Layer 1: Frontend UI]
       │
       ▼ (HTTP Fetch / REST)
[Layer 2: API Gateway]             backend/main.py
       │
       ▼
[Layer 3: Agent Orchestration]     backend/agent/orchestrator.py
       │
       ├──────────────────────────────────┐
       ▼                                  ▼
[Layer 4: Model Routing]          [Layer 5: Modular Tools]
 backend/agent/router.py           backend/tools/registry.py
       │                                  │
       │           ┌──────────────────────┼──────────────────────┐
       │           ▼                      ▼                      ▼
       │     [AST Sandbox]          [Document Intel]        [Knowledge Base]
       │     backend/sandbox/       backend/multimodal/     backend/rag/
       │           │                      │                      │
       └───────────┴──────────────────────┼──────────────────────┘
                                          ▼
                             [Deliverable Generation]
                             backend/documents/
                                          │
                                          ▼
                       [Security & Sovereignty Audit]
                       backend/security/sovereignty_monitor.py
                                          │
                                          ▼
                            [Central Configuration]
                            backend/config/settings.py
```

---

## 2. Who Imports Whom?

### Layer 1: Frontend (`frontend/`)
- **Imports**: Does NOT import Python code.
- **Dependencies**: Browser Web APIs (`fetch`, `DOM`, `Canvas`).
- **Calls**: Communicates exclusively via HTTP JSON payloads to `http://127.0.0.1:8000/`.

### Layer 2: API Gateway (`backend/main.py`)
- **Imports**:
  - `Flask`, `flask_cors`
  - `backend.agent.orchestrator` (`orchestrator`)
  - `backend.agent.router` (`classify_task`, `check_local_model_availability`, `_CONFIG`)
  - `backend.security.sovereignty_monitor` (`sovereignty_monitor`)
  - `backend.rag.indexer` (`seed_database`)
  - `backend.tools.registry` (`registry`)
  - `backend.config.settings`
- **Rule**: Acts as the HTTP translation boundary; contains no agent decision logic.

### Layer 3: Agent Orchestration (`backend/agent/orchestrator.py`)
- **Imports**:
  - `backend.agent.router` (`route_task`, `invoke_local_model`)
  - `backend.tools.registry` (`registry`)
  - `backend.documents.deliverable_generator` (`deliverable_gen`)
  - `backend.sandbox.security` (`ToolSecurity`)
  - `backend.config.settings`
- **Rule**: Manages agent state, plans, tool executions, and self-healing loops. Does not import Flask or UI code.

### Layer 4: Model Router (`backend/agent/router.py`)
- **Imports**:
  - `requests` (Local loopback only: `http://localhost:11434`)
  - `backend.config.settings` (`OLLAMA_HOST`, `MODEL_ROLES`)
  - `backend.security.sovereignty_monitor` (`sovereignty_monitor`)
- **Rule**: Dispatches tasks to local models or triggers deterministic rule fallbacks.

### Layer 5: Tool Registry (`backend/tools/registry.py`)
- **Imports**:
  - `backend.sandbox.security` (`ToolSecurity`)
  - `backend.sandbox.executor` (`ExecutePythonTool`)
  - `backend.rag.knowledge_connector` (`SEARCH_KNOWLEDGE_BASE`)
  - `backend.multimodal.document_intelligence` (`process_document`, `extract_text_via_ocr`)
  - `backend.documents.deliverable_generator` (`deliverable_gen`)
  - `backend.security.sovereignty_monitor` (`sovereignty_monitor`)
- **Rule**: Serves as the central dispatcher for safe local capabilities.

### Layer 6: Core Services
- **AST Sandbox (`backend/sandbox/`)**:
  - `security.py`: Uses standard library `ast`, `os`, `re`. Zero external imports.
  - `executor.py`: Imports `ToolSecurity`, redirects `sys.stdout`.
- **Multimodal (`backend/multimodal/document_intelligence.py`)**:
  - Uses `pypdf`, `PIL`, and calls `invoke_local_model` from `backend.agent.router`.
- **RAG (`backend/rag/knowledge_connector.py`)**:
  - Uses `chromadb`, `sentence_transformers`, and `backend.multimodal.document_intelligence`.
- **Deliverables (`backend/documents/deliverable_generator.py`)**:
  - Uses `python-docx`, `openpyxl`, `python-pptx`, standard `csv`, and `ast`.

### Layer 7: Security & Sovereignty (`backend/security/sovereignty_monitor.py`)
- **Imports**: Standard library only (`socket`, `time`, `json`, `threading`, `urllib`).
- **Rule**: Self-contained. Hooks at the Python socket/adapter level to monitor outbound traffic.

---

## 3. Circular Dependency Safeguards

1. **No Lower-to-Higher Imports**: `backend/security/`, `backend/config/`, and `backend/sandbox/security.py` never import the agent or API modules.
2. **Decoupled Tools**: Tools interact through schemas and standard dictionaries rather than direct agent state references.
3. **Clean Compatibility Adapters**: Legacy entry points (`tools.py`, root `backend.py`) act solely as pass-through re-exporters and contain no unique business logic.
