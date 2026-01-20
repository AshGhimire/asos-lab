```markdown
# 01-implementation-plan.md
## Implementation Plan (Hard-Scoped Phases)

This file is the build order for the ASOS/ACIRL MVP.  
**Rule:** do phases in order. Each phase has a concrete “done” checkpoint. Don’t add scope.

---

## Phase 0 — Repo + Workflow
### Goal
You can boot everything from one command and iterate fast.

### Deliverables
- Monorepo structure in place
- Makefile targets:
  - `make up` (cluster + deploy)
  - `make down`
  - `make logs`
  - `make chaos`
  - `make attack`

### Done When
- `make up` reliably brings up your local cluster and prints service URLs (web, api-service, brain, prometheus optional).

---

## Phase 1 — Local Kubernetes
### Goal
Everything runs in Kubernetes (not just docker-compose).

### Deliverables
Deploy all components into the local cluster:
- `api-service`
- `brain` (FastAPI)
- `web` (Next.js)
- `postgres` (+ pgvector)
- `prometheus`
- (optional) `otel-collector`

### Done When
- `kubectl get pods` shows all pods Running/Ready
- you can hit:
  - `api-service /health`
  - `api-service /metrics`
  - web UI loads

---

## Phase 2 — Telemetry
### Goal
You can see real-time service behavior via metrics.

### Deliverables
- `api-service` exports Prometheus metrics:
  - request count
  - error count
  - latency (histogram recommended)
  - auth failures count
- Prometheus scrapes `api-service`

### Done When
- you can force errors/auth failures and see the counters change in Prometheus queries

---

## Phase 3 — Incident Model
### Goal
You have a real data model and incident API.

### Deliverables
- Postgres schema:
  - `incidents`
  - `evidence`
  - `actions`
  - (optional) `events`
- `brain` exposes APIs:
  - `GET /incidents` (list)
  - `GET /incidents/{id}` (detail + evidence)
  - `POST /incidents/{id}/investigate` (later phases can stub)
  - `POST /incidents/{id}/approve` / `reject` (later phases can stub)

### Done When
- you can create an incident record and retrieve it via API

---

## Phase 4 — Detection Loop
### Goal
Incidents are created automatically from deterministic rules.

### Deliverables
- A detector loop in `brain` running every N seconds:
  - queries Prometheus over last 1–2 minutes
  - if thresholds crossed → create/open incident (dedupe if already open)
  - attach evidence snapshots (query + results + timestamp)

### Done When
- `make chaos` produces a `SERVICE_DEGRADATION` incident
- `make attack` produces an `AUTH_ABUSE` incident
- both show evidence snapshots stored in Postgres

---

## Phase 5 — Web Command Center
### Goal
You can watch incidents happen live.

### Deliverables
- Next.js pages:
  - incident list
  - incident detail (evidence timeline)
- Real-time updates using SSE:
  - `brain`: `GET /stream/incidents`
  - `web`: subscribes and updates without refresh

### Done When
- a new incident appears in the UI without manually refreshing the page

---

## Phase 6 — AI Investigator
### Goal
The system explains “why” and proposes a typed plan (but does not execute yet).

### Deliverables
- `brain` investigation endpoint:
  - `POST /incidents/{id}/investigate`
- LLM output is **structured JSON** only:
  - hypotheses[] with confidence
  - plan[] with typed actions (only the 3 allowed)
  - rationale with evidence references

### Done When
- clicking “Investigate” returns a valid JSON plan for each incident type

---

## Phase 7 — Policy Gate
### Goal
Safety rules decide what is allowed, and human approval is supported.

### Deliverables
- Policy engine rules implemented:
  - max 1 action per incident (MVP)
  - BlockIP requires confidence ≥ 0.80
  - Scale limited to +1
- Approval modes:
  - Recommend mode (requires click)
  - Auto mode (optional, only allow RestartDeployment for degradation)
- Policy decisions logged with reasons

### Done When
- the UI shows policy verdict + allows Approve/Reject and stores decision in DB

---

## Phase 8 — Executors
### Goal
Typed actions actually change the system.

### Deliverables
- RestartDeployment executor (Kubernetes client)
- ScaleDeployment executor (Kubernetes client)
- BlockIP executor:
  - `brain` calls `api-service /internal/block-ip` with TTL and reason
- Every execution is audited (inputs + results)

### Done When
- approving an action causes a real observable change:
  - pods restart OR replicas increase OR IP is blocked and requests get 403

---

## Phase 9 — Verification
### Goal
Close the loop: confirm the action worked.

### Deliverables
- Verification loop:
  - re-query Prometheus for 1–3 minutes after action
  - mark incident RESOLVED only when metrics return below threshold
  - store verification results in DB

### Done When
- the UI shows “before → action → after” and incident transitions to RESOLVED on success

---
```
