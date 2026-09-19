# KAVAAI Sovereign — Deployment & Architecture Guide
## Dual-Layer Sovereign AI Architecture (Vercel + Render + Supabase + Local Ollama Node)

---

## 1. Executive Summary & Architecture Overview

KAVAAI Sovereign is architected with a strict separation between public web access and sovereign intelligence. Confidential enterprise data and proprietary reasoning operations **never touch any external cloud LLM**.

```
                🌐 USER
                  │
                  ▼
        KAVAAI Sovereign Website
              (Vercel)
                  │
          HTTPS / API calls
                  ▼
             Render
          Backend / APIs
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   Supabase              Public
 Auth + Database        App Metadata
        │
        │
        │       LOCAL MACHINE
        │
        │    ┌────────────────────┐
        └────│ KAVAAI Local Node  │
             │                    │
             │ Ollama             │
             │ Qwen 2.5 7B        │
             │ RTX GPU            │
             └────────────────────┘
```

### The Two Architectural Layers:

1. **Public Application Layer (Cloud)**
   - **Frontend (Vercel)**: Static Single Page Application (HTML5, CSS3, ES6) providing the metallic gold & dark crystal operator console, authentication UI, and telemetry dashboards.
   - **Backend API (Render)**: Python/Flask 3.x web service wrapped with Gunicorn for public REST endpoints, metadata synchronization, and session validation.
   - **Authentication & Metadata (Supabase)**: Managed PostgreSQL database handling user identity, encrypted profile storage, and role-based access control (RBAC).

2. **Local Sovereign AI Layer (Air-Gapped / Workstation)**
   - **Hardware**: Dedicated local workstation (Windows 11 / Linux) with an NVIDIA RTX GPU (RTX 3050 6GB or higher).
   - **Inference Engine**: Ollama 0.34.2 serving `qwen2.5:7b` (Q4_K_M quantization, ~4.7 GB) with 100% GPU VRAM offload.
   - **Retrieval-Augmented Generation (RAG)**: Local ChromaDB vector store running local `sentence-transformers` embeddings over on-premise industrial documentation.
   - **Security Enforcement**: In-process `SovereigntyMonitor` outbound socket guard intercepting all network activity, guaranteeing zero cloud LLM egress.

> [!IMPORTANT]
> **Render → Local Ollama Connection Status**: **NOT CONNECTED / NOT APPLICABLE**.
> The public Render cloud backend never attempts to connect to `http://localhost:11434` or use unsecured public tunnels to reach your private workstation. Sovereign reasoning workloads are dispatched and executed on the authenticated Local KAVAAI Node.

---

## 2. Public Application Layer Deployment

### A. Frontend Deployment (Vercel)

The frontend is a vanilla web application located in `frontend/`. It does not require a Node.js build process.

#### 1. Repository Configuration
A root `vercel.json` is configured with clean routing:
```json
{
  "version": 2,
  "public": true,
  "cleanUrls": true,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://<YOUR-RENDER-APP>.onrender.com/api/$1" },
    { "source": "/(.*)", "destination": "/frontend/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

#### 2. Environment Variables in Vercel
Set the following environment variables in the Vercel Project Dashboard:
| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public Render backend API URL | `https://kavaai-api.onrender.com` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xyzproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY`| Supabase Public Anon Key | `eyJhbGciOi...` |

*(Note: `frontend/config.js` automatically binds these values into `window.KAVAAI_ENV` upon page load).*

#### 3. Deployment Steps
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set **Framework Preset**: *Other*.
3. Set **Root Directory**: `./` (or `frontend` if deploying without root proxy).
4. Save and click **Deploy**.

---

### B. Backend Deployment (Render)

The backend is configured in `backend/main.py` using Flask and Gunicorn.

#### 1. Render Blueprint (`render.yaml`)
```yaml
services:
  - type: web
    name: kavaai-sovereign-api
    env: python
    region: oregon
    plan: starter
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn -w 2 -b 0.0.0.0:$PORT backend.main:app"
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.10
      - key: FLASK_ENV
        value: production
      - key: NETWORK_MODE
        value: CLOUD_API_GATEWAY
      - key: ALLOW_EXTERNAL_AI
        value: "false"
      - key: CORS_ORIGINS
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true
```

#### 2. Render Environment Variables
Configure the following in the Render Dashboard:
- `CORS_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://kavaai.vercel.app,http://localhost:8000`).
- `PORT`: Set automatically by Render (default 10000).
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase backend service role key.
- `JWT_SECRET`: Random 64-character secret for local token validation.

---

### C. Authentication & Database Setup (Supabase)

Supabase handles user identity, audit logging, and metadata persistence.

#### 1. Database Schema
Execute the following SQL migration in the Supabase SQL Editor:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table linked to auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role text default 'operator' check (role in ('admin', 'operator', 'auditor')),
  organization text default 'KAVAAI Sovereign',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

-- Audit Events Table (System and Sovereignty Logs)
create table public.audit_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users,
  event_type text not null,
  component text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Audit Events
alter table public.audit_events enable row level security;
create policy "Users can insert audit events" on public.audit_events
  for insert with check (auth.uid() = user_id);
create policy "Admins can view all audit events" on public.audit_events
  for select using (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

---

## 3. Local Sovereign AI Layer Configuration

The Local Node is where 100% of intelligence, private document retrieval, and model reasoning takes place.

### Hardware Prerequisites
- **Workstation**: HP Victus or equivalent x86_64 machine.
- **GPU**: NVIDIA GeForce RTX 3050 (6GB VRAM) or higher with CUDA 12.x+ drivers.
- **RAM**: 16 GB system memory minimum.
- **Disk**: 20 GB free SSD storage.

### 1. Install & Verify Ollama
1. Download Ollama for Windows from [ollama.com](https://ollama.com).
2. Pull the sovereign reasoning model:
   ```bash
   ollama pull qwen2.5:7b
   ```
3. Verify running instances and model status:
   ```powershell
   ollama list
   # Expected output:
   # NAME          ID           SIZE      MODIFIED
   # qwen2.5:7b    845dbda0ea48 4.7 GB    ...
   ```
4. Verify GPU VRAM offload:
   ```powershell
   nvidia-smi
   # Confirm llama-server.exe process is consuming ~4.2 GB VRAM on the NVIDIA RTX GPU.
   ```

### 2. Local Node Environment Configuration (`.env`)
Create or verify your local `.env` file:
```env
# AI Model Configuration
DEFAULT_MODEL=qwen2.5:7b
REASONING_MODEL=qwen2.5:7b
VISION_MODEL=qwen2.5vl:7b
OLLAMA_BASE_URL=http://localhost:11434

# Security & Sovereignty
NETWORK_MODE=LOCAL_ONLY
ALLOW_EXTERNAL_AI=False
ALLOW_CLOUD_FALLBACK=False
AIR_GAP_STRICT_MODE=True

# Hardware & Server
GPU_ENABLED=True
PORT=8000
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000,https://kavaai.vercel.app
```

---

## 4. Verification & Operational Health Checks

### Comprehensive System Health Audit
Execute the local diagnostic suite:
```powershell
python scripts/check_health.py
```
**Expected Output:**
```
==================================================
                 KAVAAI HEALTH                    
==================================================
Application        ✓
Backend            ✓
Ollama             ✓
Reasoning Model    ✓
Vision Model       PENDING
RAG                ✓
ChromaDB           ✓
Knowledge Base     ✓
Required Dirs      ✓
GPU                ✓
Security Mode      LOCAL_ONLY
==================================================

--------------------------------------------------
             OLLAMA STATUS AUDIT                  
--------------------------------------------------
OLLAMA SERVER: READY
MODEL: qwen2.5:7b
MODEL AVAILABLE: YES
INFERENCE TEST: PASS
--------------------------------------------------
Overall Status : HEALTHY
```

### Air-Gap & Sovereignty Verification
Audit the outbound guard and network socket interception:
```powershell
python scripts/verify_security_network.py
```
**Expected Output:**
```
==================================================
      KAVAAI SECURITY & NETWORK VALIDATION        
==================================================
[1/9] Checking LOCAL_ONLY Mode...                 VERIFIED
[2/9] Checking External AI Configuration...       VERIFIED
[3/9] Checking Ollama Local Endpoint...           VERIFIED
[4/9] Checking Network Endpoint Logging...        VERIFIED
[5/9] Testing External Request Detection...       VERIFIED
[6/9] Testing Enforceable Blocked Request Logging... VERIFIED
[7/9] Verifying Security Audit Events Structure... VERIFIED
[8/9] Auditing Logs for Confidential Data Exposure... VERIFIED
[9/9] Checking Physical vs Application Air-Gap... VERIFIED

VALIDATION METRICS:
LOCAL AI CALLS    : 0 (VERIFIED)
EXTERNAL CALLS    : 0 (STRICTLY 0)
BLOCKED CALLS     : 1 (VERIFIED)
ENVIRONMENT TIER  : APPLICATION_GUARD_ENFORCED
```

### Automated Regression Testing
Run the complete regression suite:
```powershell
pytest
```
**Result**: `37 passed` across authentication, routing, vector retrieval, and agent orchestration modules.

---

## 5. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| `Ollama connection refused` | Ollama background daemon not running | Run `ollama serve` or launch Ollama from Windows Start Menu. |
| `CUDA out of memory` | Other GPU processes occupying VRAM | Close background 3D apps. Run `nvidia-smi` to inspect processes. `qwen2.5:7b` requires ~4.5 GB VRAM. |
| `CORS Error on Web App` | Render backend missing Vercel URL in CORS | Add your Vercel app domain to `CORS_ORIGINS` in the Render dashboard. |
| `401 Unauthorized from Supabase`| Invalid Anon Key / Expired Session | Verify `VITE_SUPABASE_ANON_KEY` matches the key in Supabase Project Settings → API. |
| `Render -> Ollama 502/Timeout`| Invalid architectural assumption | Render cannot and should not reach local Ollama. Verify requests are routed through the local node client. |

---

## 6. Architecture Compliance Guarantee

1. **Zero External LLM APIs**: No OpenAI, Anthropic, Gemini, Groq, or Together APIs are integrated or active.
2. **Local Vector Storage**: Industrial knowledge base vectors remain stored strictly on-premise within `./chroma_db`.
3. **Transparent Auditing**: All local inference prompts and completions trigger an `[LOCAL_AI]` log and are appended to `output/sovereignty_audit.jsonl` without exposing sensitive prompt text.
