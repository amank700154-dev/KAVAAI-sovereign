# KAVAAI SOVEREIGN — Production & Demo Deployment Architecture
**SIH26117: Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work**

---

## 1. System Architecture & Component Mapping

KAVAAI SOVEREIGN is an on-premise, air-gapped agentic AI workbench. The entire operational lifecycle—from document ingestion and telemetry streaming to LLM reasoning, code sandbox execution, and deliverable creation—executes strictly within the local host boundary.

```mermaid
graph TD
    User([Operator / Engineer]) -->|Browser HTTP / WebSockets| UI[Frontend UI: HTML5 + CSS3 + Vanilla ES6<br/>127.0.0.1:8000]
    
    subgraph Host Workstation Boundary [Air-Gapped Workstation Boundary (127.0.0.1)]
        UI -->|REST APIs & Telemetry Polling| AppServer[Application Server: Flask 3.x<br/>backend/main.py :8000]
        
        AppServer --> Orchestrator[Agent Orchestrator<br/>agent_orchestrator.py]
        AppServer --> DocIntel[Document Intelligence & Local OCR<br/>document_intelligence.py]
        AppServer --> Deliverables[Deliverable Generator<br/>deliverable_generator.py]
        AppServer --> SecurityGuard[Sovereignty Security Outbound Guard<br/>sovereignty_monitor.py]
        
        Orchestrator --> ModelRouter[Dynamic Model Router<br/>model_router.py]
        Orchestrator --> ToolSandbox[AST Sandboxed Tool System<br/>tool_system.py]
        Orchestrator --> KnowledgeRAG[Multimodal Vector RAG<br/>index_document.py]
        
        ModelRouter -->|HTTP Loopback :11434| Ollama[Ollama Local Inference Daemon<br/>127.0.0.1:11434]
        
        KnowledgeRAG --> ChromaDB[(ChromaDB Vector Store<br/>chroma_db/chroma.sqlite3)]
        KnowledgeRAG --> Embedder[Embedding Model<br/>all-MiniLM-L6-v2]
        
        Deliverables --> Storage[Local File Storage<br/>output/ & workspace/output/]
    end
    
    subgraph Compute Acceleration Layer
        Ollama -->|CUDA 12.x / ROCm| GPU[(Host GPU: NVIDIA CUDA<br/>or Multi-Threaded CPU Fallback)]
        Embedder -->|Torch CUDA| GPU
    end
    
    SecurityGuard -.->|INTERCEPT & BLOCK| ExternalWAN[External WAN / Cloud Services<br/>api.openai.com, etc.]
```

---

## 2. Current Startup Sequence

1. **Host Environment Activation**:
   - Python 3.10 - 3.12 environment with virtualenv (`.venv`).
2. **Local Model Daemon (Ollama)**:
   - Ollama service running on loopback (`http://127.0.0.1:11434`).
   - Models loaded into Ollama memory: `qwen2.5:7b` (reasoning/coding), `qwen2.5vl:7b` (vision).
3. **Application Server Boot (`backend/main.py`)**:
   - Ingests environment overrides (`.env` / `model_config.json`).
   - Ensures workspace paths exist (`output/`, `workspace/output/`, `chroma_db/`).
   - Automatically executes `seed_database()` in `index_document.py`:
     - Initializes `SentenceTransformer("all-MiniLM-L6-v2")`.
     - Mounts `chroma_db/chroma.sqlite3` (`industrial_documents` collection).
     - Auto-seeds baseline technical manual chunks.
   - Activates active outbound network interception via `sovereignty_monitor.install_outbound_guard(strict=True)`.
   - Starts HTTP server on `127.0.0.1:8000`.
4. **Client Interface Access**:
   - Operator opens `http://127.0.0.1:8000/`.
   - Frontend detects authentication state: displays secure login console or unlocks active operator session into dashboard.

---

## 3. Required Services

| Service | Technology | Port / Endpoint | Responsibility | Isolation Level |
| :--- | :--- | :--- | :--- | :--- |
| **KAVAAI Application** | Flask 3.x / WSGI | `127.0.0.1:8000` | Frontend serving, REST APIs, agent orchestration, deliverables engine, telemetry stream | Local Loopback Only |
| **Ollama Inference Engine** | Ollama Native Service | `127.0.0.1:11434` | Local execution of open-weight LLMs (`qwen2.5:7b`, `qwen2.5vl:7b`) | Local Loopback Only |
| **ChromaDB Vector Store** | ChromaDB Embedded | In-Process (SQLite/Parquet) | Semantic indexing, document chunk embeddings, vector similarity search | In-Memory / Local Disk |

---

## 4. Required AI Models

| Model Role | Model Identifier | Provider / Engine | Memory / VRAM Footprint | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Reasoning Model** | `qwen2.5:7b` | Ollama (Local) | ~4.7 GB (q4_K_M) / ~8 GB (FP16) | CPU Inference / Honest Degradation |
| **Coding & Math Model** | `qwen2.5:7b` | Ollama (Local) | Shared with Reasoning Model | AST Sandboxed Execution / CPU |
| **Vision & Defect Analysis** | `qwen2.5vl:7b` | Ollama (Local) | ~5.5 GB (q4_K_M) | Local Heuristic / Color Histogram Fallback |
| **Embedding Model** | `all-MiniLM-L6-v2` | PyTorch / SentenceTransformers | ~120 MB RAM / VRAM | CPU Torch |

*Zero external / cloud AI fallbacks exist. If Ollama or model files are missing, the system reports `NOT AVAILABLE` rather than transmitting data to remote APIs.*

---

## 5. Required Python Packages

```text
flask>=3.0.0
flask-cors>=4.0.0
requests>=2.31.0
chromadb>=0.5.0
sentence-transformers>=3.0.0
torch>=2.2.0 (with CUDA support for GPU acceleration)
pypdf>=4.0.0
python-docx>=1.1.0
openpyxl>=3.1.0
python-pptx>=0.6.20
pillow>=10.0.0
pytest>=8.0.0 (verification suite)
pytest-asyncio>=0.23.0
```

---

## 6. Required Node.js Packages

- **NONE**. The frontend is built entirely using native Vanilla HTML5, CSS3, and ES6 JavaScript. There is no Node.js runtime, build step, or npm dependency required to run the application.

---

## 7. Required Directories & File Permissions

| Directory Path | Purpose | Persistence | Permissions Required |
| :--- | :--- | :--- | :--- |
| `frontend/` | UI markup, stylesheets, assets, client scripts | Static | Read-Only |
| `backend/` | API routes, configuration, controllers | Static | Read-Only |
| `data/` | Sample engineering manuals, telemetry logs | Persistent | Read-Only |
| `knowledge_base/` | Indexed SOPs, manuals, incident reports | Persistent | Read / Write |
| `chroma_db/` | Vector database SQLite and index files | Persistent | Read / Write |
| `output/` | Generated audit notes, DOCX, XLSX, PPTX, CSV, PY | Persistent | Read / Write |
| `workspace/output/` | AST sandbox isolated output files | Persistent | Read / Write / Delete |

---

## 8. Required Environment Variables

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `HOST` | `127.0.0.1` | Network interface binding (Must remain loopback for air-gap) |
| `PORT` | `8000` | HTTP port for the KAVAAI workbench |
| `OLLAMA_HOST` | `http://localhost:11434` | Endpoint for local Ollama server |
| `OLLAMA_TIMEOUT` | `90` | Request timeout in seconds for complex agent reasoning |
| `KAVAAI_REASONING_MODEL` | `qwen2.5:7b` | Model assigned to general investigation and SOP analysis |
| `KAVAAI_CODING_MODEL` | `qwen2.5:7b` | Model assigned to technical code and math scripts |
| `KAVAAI_VISION_MODEL` | `qwen2.5vl:7b` | Model assigned to multimodal inspection report vision |
| `KAVAAI_EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | SentenceTransformer embedding model identifier |
| `AIR_GAP_STRICT_MODE` | `true` | Enforces active socket-level blocking of external WAN calls |
| `SUPABASE_URL` | `""` (Empty) | Optional Supabase URL (Leave empty for offline local node) |
| `SUPABASE_ANON_KEY` | `""` (Empty) | Optional Supabase Anon Key (Public only, never service_role) |

---

## 9. Required Ports & Bindings

| Port | Service | Bound Interface | Accessibility |
| :--- | :--- | :--- | :--- |
| **8000** | KAVAAI Flask API & Frontend | `127.0.0.1` (Loopback) | Local Workstation Only |
| **11434** | Ollama Inference Daemon | `127.0.0.1` (Loopback) | Internal IPC Only |

*No service binds to `0.0.0.0` by default to prevent exposure across public networks.*

---

## 10. Hardware & GPU Specifications

- **Recommended GPU**: NVIDIA GPU with CUDA Compute Capability 6.0+ (minimum 6GB VRAM, 8GB+ recommended).
- **Tested Hardware**: NVIDIA GeForce RTX 3050 6GB Laptop GPU (CUDA 12.1, Driver 560+).
- **CPU / RAM Minimum**:
  - Quad-Core x86_64 / ARM64 processor.
  - 16 GB System RAM (for simultaneous in-memory ChromaDB, embedding weights, and OS).
- **Disk Storage**:
  - 10 GB free space for Ollama model weights (`qwen2.5:7b` + `qwen2.5vl:7b`).
  - 2 GB free space for ChromaDB vector indices and generated deliverables.
- **Graceful CPU Fallback**:
  - If CUDA is unavailable, PyTorch and Ollama automatically fall back to CPU instruction sets (AVX2/AVX-512), with execution state accurately reported via `/api/system/status`.

---

## 11. Cross-Platform Compatibility (Windows vs Linux)

| Area | Windows Support | Linux / macOS Support | Considerations |
| :--- | :--- | :--- | :--- |
| **Path Handling** | Supported (`os.path.join`, forward/backward slashes normalized) | Fully Supported (POSIX paths) | Consistent case-sensitivity handled |
| **System Memory Probing** | Uses `ctypes.windll.kernel32.GlobalMemoryStatusEx` with fallback | Uses `os.sysconf` / `/proc/meminfo` with fallback | Fully cross-platform in `backend/main.py` |
| **Socket Outbound Guard** | Monkeypatches `socket.socket.connect` and `urllib3` adapters | Same socket interception | OS-independent |
| **Sandbox Execution** | AST validation + restricted namespace | AST validation + restricted namespace | Zero OS shell dependencies |
| **Startup Scripts** | Needs `start_kavaai.bat` / PowerShell script | Needs `start_kavaai.sh` bash script | Scripts must check Python & Ollama |

---

## 12. Current Deployment Risks & Mitigations

| Risk | Impact | Root Cause | Proposed Engineering Mitigation |
| :--- | :--- | :--- | :--- |
| **1. Ollama Daemon Offline** | AI reasoning fails | Ollama service not started prior to backend boot | Add pre-flight health check script (`scripts/health_check.py`) and Windows `.bat` / Linux `.sh` starter that probes `:11434`. |
| **2. Missing Model Weights** | Orchestrator fails to route tasks | User has not pulled `qwen2.5:7b` or `qwen2.5vl:7b` | Create `scripts/setup_models.py` with progress tracking and offline model staging instructions. |
| **3. HuggingFace Cold Start** | Embedder fails in strict air-gap | `SentenceTransformer` attempts initial download if cache empty | Ensure `all-MiniLM-L6-v2` is pre-cached or local folder path configured before cutting network connection. |
| **4. Server Concurrency** | Single-threaded bottlenecks during heavy generation | Flask development server (`app.run()`) | Document and bundle a lightweight production WSGI runner (`waitress` for Windows, `gunicorn` for Linux). |
| **5. Port Conflicts** | Startup fails (Port 8000 in use) | Another dev server occupying port 8000 | Configurable `PORT` in `.env` with dynamic port availability check in startup scripts. |

---

### Audit Phase Conclusion
- **Application Code Status**: 100% Intact & Unmodified.
- **Architecture Validation**: Dual loopback service model (KAVAAI Flask + Local Ollama + Embedded ChromaDB) verified.
- **Readiness**: Ready to proceed to Phase 1 (Startup scripts, model setup scripts, health-check endpoint, and Docker setup).
