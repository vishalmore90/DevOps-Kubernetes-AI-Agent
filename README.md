# DevOps Kubernetes AI Troubleshooting Agent

An automated Site Reliability Engineering (SRE) and cluster diagnostics platform. It connects to Kubernetes clusters, gathers multi-layer diagnostic telemetry (pod status, container error logs, cluster events, deployment controllers, and service networking), and executes root-cause analysis with LLMs through OpenRouter. Investigation history and real-time status telemetry are persisted and published through InsForge.

---

## Architecture Overview

```text
+-------------------------------------------------------------------------+
|                           Kubernetes Cluster                            |
|             Pods | Deployments | Services | Events | Logs               |
+-------------------------------------------------------------------------+
                                    |
                                    | kubectl CLI / Cluster API
                                    v
+-------------------------------------------------------------------------+
|                      Diagnostic Collector Layer                         |
|                                                                         |
|  1. Pod Inspector         - Detect CrashLoopBackOff, OOMKilled, Error   |
|  2. Logs Collector        - Extract tail logs and container failures    |
|  3. Events Analyzer       - Parse scheduling, node, and image warnings  |
|  4. Deployment Inspector  - Audit replicas, rollout state, and probes   |
|  5. Network Inspector     - Validate service selectors and endpoints    |
+-------------------------------------------------------------------------+
                                    |
                                    | Structured Diagnostic Telemetry
                                    v
+-------------------------------------------------------------------------+
|                  FastAPI Orchestration & Security Layer                 |
|                                                                         |
|  - Rate Limiting (120 req/min per IP sliding window)                    |
|  - Security Headers (HSTS, X-Frame-Options, nosniff, XSS protection)    |
|  - Input Validation & Context Sanitization (Regex pattern filtering)    |
|  - Dynamic Kubeconfig Bootstrapping (KUBECONFIG_DATA / Secret Files)   |
+-------------------------------------------------------------------------+
            |                                           |
            | Reasoning Request                         | Realtime Events & CRUD
            v                                           v
+-----------------------------+           +-------------------------------+
|     AI Reasoning Engine     |           |     InsForge Backend (BaaS)   |
|                             |           |                               |
|  - OpenRouter API Gateway   |           |  - Email/Password + OTP Auth  |
|  - Models: GPT-4o, Claude   |           |  - Postgres RLS Investigations|
|  - Root-cause identification|           |  - Socket.IO Realtime Pub/Sub |
|  - Actionable CLI fixes     |           |  - Database Trigger Pipeline  |
+-----------------------------+           +-------------------------------+
                                                        |
                                                        | Realtime Stream & REST
                                                        v
+-------------------------------------------------------------------------+
|                       Next.js Frontend Console                          |
|                                                                         |
|  - High-contrast Obsidian Design System (Inter + Monospace)             |
|  - Target Cluster Context Switcher & Health Indicator                   |
|  - Realtime Milestone Progress Tracker (Live Socket.IO)                 |
|  - Root Cause Analysis, Severity, Remediation Code Blocks               |
|  - Diagnostic Evidence Inspector (Pods, Deployments, Events, Network)   |
|  - InsForge Row-Level Security Protected Incident History               |
|  - Privacy Policy (/privacy) & Terms of Service (/terms)                |
+-------------------------------------------------------------------------+
```

---

## Features

### 1. Automated Kubernetes Diagnostics
- **CrashLoopBackOff**: Identifies missing environment variables, config maps, database connectivity errors, and exit codes.
- **ImagePullBackOff & ErrImagePull**: Detects malformed image repositories, invalid tags, and registry authentication issues.
- **OOMKilled**: Flags memory limit violations and runaway container allocations.
- **Pending & Scheduling Failures**: Analyzes insufficient CPU/memory, node taints, tolerations, and affinity mismatches.
- **Deployment Rollout Stalls**: Surfaces failing liveness and readiness probes, replica mismatches, and failed update strategies.
- **Network & Service Misconfigurations**: Detects selector mismatches where services point to zero endpoints.

### 2. SRE Root Cause Reasoning
- Normalizes telemetry across pods, logs, events, and services into a structured prompt.
- Calculates diagnosis confidence scores (0 to 100%).
- Provides copyable `kubectl` commands and manifest fixes.

### 3. InsForge Backend Integration
- **Authentication**: Email/password authentication with 6-digit OTP verification.
- **Row-Level Security (RLS)**: Enforces `auth.uid() = user_id` on the PostgreSQL `investigations` table.
- **Realtime Milestone Streaming**: Emits live progress milestones (`Checking Pods` -> `Reading Logs` -> `Analyzing Events` -> `AI Reasoning` -> `Root Cause Found`) over Socket.IO channels (`investigation:<user_id>`).

### 4. Hardened Production Security
- **Security Headers**: HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`.
- **IP Rate Limiting**: Built-in sliding-window limiter on FastAPI endpoints.
- **Zero Secret Exposure**: Strict `.gitignore` policy for all credentials, tokens, and cluster keys.

---

## Project Structure

```text
DevOps-Kubernetes-AI-Agent/
├── backend/
│   ├── app/
│   │   ├── ai/                 # OpenRouter AI prompt construction & reasoning
│   │   ├── api/                # FastAPI routers (/health, /contexts, /investigate)
│   │   ├── core/               # Pydantic Settings configuration & CORS parsing
│   │   ├── kubernetes/         # Kubectl command execution & resource inspectors
│   │   ├── models/             # Schema definitions & input validation
│   │   ├── services/           # Orchestration & InsForge realtime publisher
│   │   └── main.py             # FastAPI entrypoint, rate limiter, security headers
│   ├── migrations/             # SQL schema, RLS policies & triggers for InsForge
│   ├── Dockerfile              # Production Dockerfile with kubectl CLI
│   └── requirements.txt        # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── privacy/        # Privacy policy page
│   │   │   ├── terms/          # Terms of service page
│   │   │   ├── verify-email/   # Email OTP verification (with Suspense boundary)
│   │   │   ├── icon.svg        # Scalable vector favicon
│   │   │   ├── layout.tsx      # Root layout & Inter font configuration
│   │   │   └── page.tsx        # SRE diagnostic dashboard console
│   │   ├── hooks/              # React Query mutation hooks
│   │   ├── lib/                # InsForge TypeScript SDK client
│   │   ├── services/           # Axios HTTP client
│   │   └── types/              # TypeScript interfaces for cluster telemetry
│   ├── next.config.mjs         # Next.js security headers & CSP
│   ├── package.json            # Frontend dependencies (Next 14, Tailwind 3.4)
│   └── vercel.json             # Vercel deployment configuration
├── tests/
│   ├── scenarios/              # Test Kubernetes manifests (CrashLoop, OOM, ImagePull)
│   └── test_api.py             # Pytest test suite for backend & InsForge realtime
├── render.yaml                 # Render Blueprint configuration for Docker web service
└── docker-compose.yml          # Local container orchestration
```

---

## Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 18+ and npm
- Docker and Docker Compose (optional)
- Active Kubernetes cluster (e.g., kind, Minikube, or remote cluster)

### 1. Environment Configuration

Create a root `.env` (or configure `backend/.env` and `frontend/.env.local`):

**Backend (`backend/.env`):**
```env
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=openai/gpt-4o
INSFORGE_API_KEY=ik_your_insforge_api_key
INSFORGE_API_BASE_URL=https://<app-key>.ap-southeast.insforge.app
KUBECONFIG_PATH=~/.kube/config
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_INSFORGE_BASE_URL=https://<app-key>.ap-southeast.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=anon_your_insforge_anon_key
```

### 2. Run the Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Verify the health check:
```bash
curl http://localhost:8000/health
# {"status":"healthy","service":"ai-kubernetes-agent"}
```

### 3. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing

### Run Backend Unit Tests
```bash
pytest tests/ -v
```
Tests cover:
- Root API endpoint availability
- Health check response (`/health`)
- Pydantic environment settings and origin parsing
- Kubernetes context listing (`/contexts`)
- InsForge realtime progress event publishing

### Deploy Test Failure Scenarios to Kubernetes
The repository includes pre-built failure manifests in `tests/scenarios/`:
```bash
# CrashLoopBackOff test pod (missing required DB credentials)
kubectl apply -f tests/scenarios/01-crashloop.yaml

# ImagePullBackOff test pod (invalid container tag)
kubectl apply -f tests/scenarios/02-imagepull.yaml

# OOMKilled test pod (memory exhaustion loop)
kubectl apply -f tests/scenarios/03-oomkilled.yaml

# Service selector mismatch (service targeting non-existent labels)
kubectl apply -f tests/scenarios/04-service-selector.yaml
```
Run an investigation from the dashboard to watch the agent detect each failure mode.

---

## Production Cloud Deployment

### 1. FastAPI Backend (Render)
The backend runs as a Docker container with `kubectl` pre-installed.

1. Create a new **Web Service** on Render from your GitHub repository.
2. Select **Docker** as the runtime.
   - **Docker Context**: `./backend`
   - **Dockerfile Path**: `./backend/Dockerfile`
3. Configure Environment Variables:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key.
   - `OPENROUTER_MODEL`: `openai/gpt-4o`
   - `INSFORGE_API_BASE_URL`: Your InsForge endpoint.
   - `INSFORGE_API_KEY`: Your InsForge API key.
   - `ALLOWED_ORIGINS`: `*` (or your Vercel frontend URL).
   - `KUBECONFIG_DATA`: Base64-encoded kubeconfig YAML for your remote cluster (optional).
4. Set Health Check Path to `/health`.

### 2. Next.js Frontend (Vercel)
1. Import the repository on Vercel.
2. Set the **Root Directory** to `frontend`.
3. Configure Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL`: Your Render backend URL (`https://<service-name>.onrender.com`).
   - `NEXT_PUBLIC_INSFORGE_BASE_URL`: Your InsForge backend URL.
   - `NEXT_PUBLIC_INSFORGE_ANON_KEY`: Your InsForge anonymous key.
4. Click **Deploy**.

---

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.
