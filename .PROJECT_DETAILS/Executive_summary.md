# ACIRL / ASOS-Lab — Autonomous Chaos & Incident Response Lab
**Date:** Saturday, January 17, 2026  
**Project Codename:** ACIRL  
**Product Name:** ASOS (Autonomous Systems Operations Sentinel) + ACIRL (embedded validation lab)

---

## Executive Summary
ACIRL is a local, production-style Kubernetes lab where real incidents are **detected**, **investigated**, and **safely remediated** in real time by a policy-governed autonomous operator.

**ASOS** is the operator: it ingests telemetry, detects failures/attacks, correlates evidence into incidents, uses an AI investigator to propose a **typed remediation plan**, enforces a **policy gate**, executes **only pre-approved actions**, and then **verifies recovery** against explicit SLO checks.

**ACIRL** is the proof harness: reproducible chaos + attack scenarios that continuously validate the closed-loop system end-to-end.

**Core Loop (non-negotiable):**  
Failure/Attack → Telemetry → Incident → Investigation (AI) → Typed Plan → Policy Gate → Execution → Verification → Knowledge Store

---

## HARD MVP Requirements (Sacred Line)
MVP is done when your system can autonomously **detect, explain, and safely remediate**:
- **1 infrastructure failure** (CrashLoop)
- **1 security anomaly** (Credential Stuffing)
in real time, with:
- **exactly 3 actions** implemented and executable
- **policy gate** that can block unsafe actions
- **verification** that closes the loop
- **auditability** (who/what/why/when + evidence)

### MVP Scope (Allowed)
**Environment**
- Local Kubernetes cluster: **k3d** (recommended) or kind
- Exactly **2 app services**:
  - `api-service` (target that can fail/be attacked)
  - `web` (observer/control UI)
- Plus control-plane services:
  - `brain` (FastAPI incident engine)
  - `postgres` (+ pgvector)
  - `otel-collector`
  - `prometheus`

**Telemetry**
- Metrics: request rate, error rate, latency, auth failure count
- Logs: structured JSON
- Traces: optional minimal (can be Phase 2+)

**Incidents (exactly 2 types)**
- `SERVICE_DEGRADATION` (5xx spike / crashloop symptoms)
- `AUTH_ABUSE` (auth failures spike / credential stuffing)

**AI Investigation (bounded)**
- Input: incident summary + evidence snapshots + relevant logs
- Output: structured JSON only:
  - hypotheses with confidence
  - evidence-cited explanation
  - typed action plan using only allowed actions

**Actions (exactly 3)**
1. `RestartDeployment`
2. `ScaleDeployment` (max +1)
3. `BlockIP` (TTL required)

**Policy Gate (simple but real)**
- Max 1 action per incident (MVP)
- `BlockIP` requires confidence ≥ 0.80
- `ScaleDeployment` limited to +1 replica
- Manual approval toggle (Recommend vs Auto)
- Every decision + action is logged

**Verification (non-negotiable)**
After execution, verify:
- Degradation: error rate drops below threshold, latency stabilizes
- Auth abuse: auth failures drop below threshold
If verification fails:
- Incident remains open
- No auto retries in MVP

**ACIRL Scenarios (exactly 2)**
- Scenario A: CrashLoop injection → detect → restart → verify recovery
- Scenario B: Credential stuffing script → detect → block IP TTL → verify signal drop

### Explicit Non-Goals (prevents overscope)
- No fine-tuning
- No multi-agent framework
- No RBAC / multi-env
- No fancy tracing UI
- No cloud provider deployment pre-MVP
- No plugin system
- No arbitrary shell execution

---

## Architecture Overview (Implementation-Level)
### High-Level Dataflow
1. **Telemetry**
   - `api-service` emits Prometheus metrics + structured logs
   - `prometheus` scrapes metrics
   - logs optionally shipped to `brain` (HTTP ingest) or via otel collector

2. **Detection & Correlation (brain)**
   - A periodic detector loop queries Prometheus for windows (e.g., last 2 minutes)
   - If thresholds crossed → create/update incident
   - Capture evidence snapshots (query + result + timestamp)

3. **Investigation (AI)**
   - On demand (button in UI) or auto for new incidents
   - AI produces typed plan + rationale with evidence references
   - AI never executes actions

4. **Policy Gate**
   - Validates plan type, confidence, blast radius, and rules
   - Requires approval if in Recommend mode

5. **Execution**
   - `RestartDeployment` / `ScaleDeployment` via Kubernetes API from `brain`
   - `BlockIP` via `api-service` internal endpoint (denylist TTL middleware)

6. **Verification**
   - Re-query Prometheus after action for up to N minutes
   - Mark incident resolved if checks pass, else remain open

7. **Knowledge Store**
   - Postgres stores incidents/evidence/actions/outcomes
   - pgvector supports retrieval of similar incidents (optional MVP-lite)

---

## Tools & Tech Stack
### Core
- **Kubernetes (local):** k3d (recommended) or kind
- **api-service:** Fastify + TypeScript (your current implementation)
- **brain (control plane):** FastAPI (Python) + background detector loop
- **web UI:** Next.js (TypeScript)
- **DB:** Postgres + pgvector
- **Metrics:** Prometheus + prom-client (Node) / prometheus client (Python)
- **Logs:** JSON logs (pino in Fastify); optional OTEL collector pipeline
- **Tracing (optional):** OpenTelemetry SDK + otel-collector

### Supporting
- **Containerization:** Docker
- **Cluster deploy:** kubectl + Kustomize (or raw manifests)
- **Automation:** Makefile + scripts
- **Auth (internal):** API key header for internal endpoints (devkey locally)

## Repo Layout (Monorepo)
* - /apps
* - /web # Next.js command center
* - /brain # FastAPI incident engine + executors + verification
* - /services (Fastify api-service (denylist + metrics + login endpoint))
* - /infra
   * * - /k8s # manifests (deployments, services, configmaps)
    * * - /otel # collector config (optional MVP)
* - /scripts (make file, testing scripts)
