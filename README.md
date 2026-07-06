# AI Kubernetes Troubleshooting Agent

An AI-powered SRE and troubleshooting platform that automatically connects to your Kubernetes clusters, collects debugging evidence (pods, logs, events, deployments, and services), analyzes the cluster state using LLMs (Llama-3, Claude, GPT via OpenRouter), and outputs root cause analyses and remediation suggestions.

---

## High Level Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                     │
│                                                            │
│  Pods | Deployments | Services | Events | Logs            │
│                                                            │
│  This is where failures happen and evidence exists         │
└────────────────────────────────────────────────────────────┘
                              │
                              │ kubectl / Kubernetes API
                              ▼
┌────────────────────────────────────────────────────────────┐
│                  Investigation Layer                      │
│                                                            │
│ Responsibility:                                            │
│ - Connect to Kubernetes cluster                            │
│ - Collect troubleshooting signals                          │
│ - Gather debugging evidence                                │
│                                                            │
│ Components:                                                │
│                                                            │
│  1. Pod Inspector                                          │
│     - Get pod health                                       │
│     - Detect CrashLoopBackOff                              │
│     - Detect Pending/Error states                          │
│                                                            │
│  2. Logs Collector                                         │
│     - Read pod logs                                        │
│     - Capture container errors                             │
│                                                            │
│  3. Events Analyzer                                        │
│     - Read Kubernetes events                               │
│     - Detect scheduling/image failures                     │
│                                                            │
│  4. Deployment Inspector                                   │
│     - Inspect deployment status                            │
│     - Verify rollout health                                │
│                                                            │
│  5. Network Inspector                                      │
│     - Check services                                       │
│     - Validate selectors                                   │
│     - Investigate DNS/networking issues                    └────────────────────────────────────────────────────────────┘
                              │
                              │ Structured Investigation Data
                              ▼
┌────────────────────────────────────────────────────────────┐
│                  AI Kubernetes Agent                      │
│                                                            │
│ Responsibility:                                            │
│ - Understand Kubernetes failures                           │
│ - Correlate logs + events + deployment state               │
│ - Identify root cause                                      │
│ - Recommend fixes                                          │
│                                                            │
│ Components:                                                │
│                                                            │
│  1. Prompt Builder                                         │
│     - Convert investigation data into LLM prompt           │
│                                                            │
│  2. LLM Reasoning Layer                                    │
│     - Uses OpenRouter API Key from InsForge                │
│     - Supports models like Llama, Claude, GPT              │
│                                                            │
│  3. Root Cause Analyzer                                    │
│     - Detect primary issue                                 │
│     - Correlate signals                                    │
│                                                            │
│  4. Fix Recommendation Engine                              │
│     - Suggest kubectl fixes                                │
│     - Recommend YAML updates                               │
│                                                            │
│  5. Confidence Scoring                                     │
│     - Confidence % for diagnosis                           │
└────────────────────────────────────────────────────────────┘
                              │
                              │ Investigation Result
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    InsForge Backend                       │
│                                                            │
│ Responsibility:                                            │
│ - Authentication (Login & SignUp)                          │
│ - Backend APIs & Cluster Context Provider                  │
│ - Investigation history                                    │
│ - Realtime investigation updates                           │
│                                                            │
│ Components:                                                │
│                                                            │
│  1. Authentication                                         │
│     - User login, registration, and OTP verification       │
│                                                            │
│  2. API Layer                                              │
│     - Trigger investigations for selected contexts         │
│     - Return AI analysis & evidence data                   │
│                                                            │
│  3. Investigation History                                  │
│     - Store previous incidents                             │
│     - Save root cause reports                              │
│                                                            │
│  4. Realtime Updates                                       │
│     - Live investigation progress via Socket.IO            │
└────────────────────────────────────────────────────────────┘
                              │
                              │ API Response
                              ▼
┌────────────────────────────────────────────────────────────┐
│                     Frontend Dashboard                    │
│                                                            │
│ Responsibility:                                            │
│ - Interactive cluster card grid selector                   │
│ - Show realtime progress checklist (Checking Pods...)      │
│ - Display root cause and explanation                       │
│ - Show suggested fixes and CLI commands                    │
│ - Show investigation history                               │
└────────────────────────────────────────────────────────────┘
```

---

## End-to-End Workflow

```text
User Selects Cluster Context
                │
                ▼
User clicks "Investigate Cluster"
                │
                ▼
Frontend sends API request
                │
                ▼
FastAPI Backend (Orchestration Layer)
                ├── Authenticate User (InsForge)
                ▼
Investigation Layer (Kubectl Executor)
                ├── Check Pods
                ├── Read Logs
                ├── Analyze Events
                ├── Inspect Deployments
                └── Check Networking
                │
                ▼
AI Kubernetes Agent (Prompt Construction)
                │
                ▼
LLM Reasoning (OpenRouter via InsForge Key)
                │
                ▼
Suggested Fix & Root Cause Generated
                ├── Save Investigation History (InsForge DB)
                ├── Realtime Progress Updates (InsForge WebSocket)
                ▼
Frontend Receives Result & Displays Diagnosis
```

---

## Supported Kubernetes Diagnostics

- **CrashLoopBackOff** (Missing environment variables, config maps, DB credentials)
- **ImagePullBackOff** (Wrong tags, missing registries, authorization failures)
- **OOMKilled** (Resource limits exceeded, container memory leak loops)
- **Pending Pods** (Scheduling issues, taint/toleration mismatch, node pressure)
- **Deployment Rollout Failures** (Stuck rollouts, failing liveness/readiness probes)
- **Service Selector Mismatch** (Endpoints missing, incorrect pod selectors)
- **DNS Resolution Problems** & **Networking Issues**

---

## Example Troubleshooting Flow

```text
Issue:
Payment service unavailable

Agent Investigation:
✓ Pod Status Checked
✓ Logs Collected
✓ Events Analyzed

Detected Problem:
CrashLoopBackOff

Root Cause:
DATABASE_URL environment variable missing

Confidence:
94%

Suggested Fix:
Update deployment.yaml and add database secret reference
```

---

## Getting Started

### Using Docker Compose (Recommended)

1. Make sure you have Docker and Docker Compose installed.
2. Provide your `.env` configuration at the root:
   ```env
   OPENROUTER_API_KEY=your-openrouter-key
   OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct
   INSFORGE_API_KEY=your-insforge-api-key
   ```
3. Start the services:
   ```bash
   docker compose up --build
   ```
4. Access:
   * **Frontend Dashboard**: `http://localhost:3000`
   * **Backend / API Health**: `http://localhost:8000/health`
   * **API Swagger Docs**: `http://localhost:8000/docs`

---

## Project Structure

```text
ai-kubernetes-agent/
├── backend/            # FastAPI Backend
│   ├── app/            # Application logic
│   │   ├── api/        # Routes/endpoints (/contexts, /investigate)
│   │   ├── core/       # Settings & environment variables
│   │   ├── kubernetes/ # Pod, logs, events, deployments, network inspectors
│   │   ├── ai/         # LLM client & Prompt templates
│   │   └── services/   # Orchestration & realtime services
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/           # Next.js Frontend (Tailwind CSS, TS)
│   ├── src/
│   │   ├── app/        # Pages (Verify-email, main dashboard)
│   │   ├── services/   # Axios API client
│   │   ├── hooks/      # React Query hooks
│   │   └── lib/        # InsForge TS SDK client
│   └── Dockerfile
├── tests/              # Failure test manifests
│   └── scenarios/      # CrashLoop, ImagePull, OOMKilled, Service Selector YAMLs
├── LICENSE             # MIT License
└── README.md
```
