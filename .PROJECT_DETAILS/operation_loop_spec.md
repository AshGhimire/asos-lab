# 02-operations-loop-spec.md
## Operations Loop Spec (Deterministic First)

This file defines the **non-AI core** of the system: how ASOS detects incidents, decides what is allowed, executes actions safely, verifies outcomes, and exposes the minimum observability needed to prove it works.

---

## 1) Detection Rules (Deterministic First)

### Principle
**Deterministic signals create incidents.**  
AI is used later for explanation + proposing a typed plan, not for deciding whether an incident exists.

### Detection Inputs (MVP)
- **Prometheus metrics** scraped from `api-service`
- (Optional) structured logs for extra evidence (not required for detection in MVP)

### Incident Types (exactly 2)

#### A) `SERVICE_DEGRADATION`
**Intent:** capture “the service is unhealthy / failing” states (CrashLoop symptoms, 5xx spikes, latency blowups)

**Primary signals**
- 5xx rate (last 2 minutes)
- request rate (last 2 minutes) for ratio context
- optional: latency p95 (histogram-based)

**Example PromQL**
- 5xx rate:
  - `sum(rate(http_requests_total{service="api-service",status=~"5.."}[2m]))`
- total request rate:
  - `sum(rate(http_requests_total{service="api-service"}[2m]))`
- 5xx ratio (if you compute in code):
  - `5xx_rate / max(total_rate, epsilon)`
- latency p95 (optional):
  - `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="api-service"}[2m])) by (le))`

**Trigger condition (example)**
- Create/keep incident OPEN if either is true for the last window:
  - `5xx_rate > 1.0 req/s` for ≥ 2 minutes, OR
  - `5xx_ratio > 0.05` for ≥ 2 minutes, OR
  - (optional) p95 latency above threshold for ≥ 2 minutes

---

#### B) `AUTH_ABUSE`
**Intent:** capture credential stuffing / brute-force login behavior.

**Primary signal**
- auth failure rate (last 2 minutes)

**Example PromQL**
- `sum(rate(auth_failures_total{service="api-service"}[2m]))`

**Trigger condition (example)**
- `auth_failure_rate > N/sec` sustained for ≥ 60–120 seconds

---

### Dedupe / Correlation Rules (MVP-simple)
**Goal:** don’t spam incidents; update the existing one.

- Build a `dedupe_key` like:
  - `"{type}:{service}:{time_bucket}"` where `time_bucket` is a coarse window (e.g., 5-minute buckets)
- If an OPEN incident exists with that `dedupe_key`:
  - attach new evidence snapshots
  - update `last_updated_at`
- If no OPEN incident exists:
  - create a new incident

### Evidence Snapshots (required)
When an incident is created or updated, store evidence records:
- query text (PromQL)
- query timestamp
- returned values / series
- threshold values used
- short textual interpretation (optional)

This is what the AI later cites. No evidence → no autonomy.

---

## 2) Policy Gate (Hard Rules)

### Principle
AI proposes. Policy decides what is **allowed**.  
Policy is the safety boundary. It must be deterministic.

### Global MVP Rules
- **Exactly 1 action executed per incident** (even if AI proposes multiple)
- Only the 3 allowed action types may execute:
  - `RestartDeployment`, `ScaleDeployment`, `BlockIP`
- Every policy decision must be logged (allow/deny + reason)
- All actions must be bounded (blast radius constrained)

### Action-Specific Rules
#### `RestartDeployment`
- Allowed for `SERVICE_DEGRADATION`
- Allowed in AUTO mode (optional MVP) **only** for this incident type

#### `ScaleDeployment`
- Must be `replicas_delta = +1` only
- Only once per incident (and only if not already scaled)

#### `BlockIP`
- Requires:
  - AI confidence ≥ **0.80**
  - TTL is present and within limit (e.g., ≤ 600s)
  - IP must be a valid parsed IP string (reject “unknown”)

### Approval Modes
- **RECOMMEND** (default)
  - AI produces plan
  - policy evaluates
  - human must click Approve/Reject in UI
- **AUTO** (optional MVP toggle)
  - Only allows `RestartDeployment` for `SERVICE_DEGRADATION`
  - Everything else still requires manual approval

---

## 3) Execution Layer (How Actions Actually Run)

### Principle
Execution is **typed and audited**. No shell. No arbitrary code execution.

### Executor Implementations (MVP)
#### A) RestartDeployment (Kubernetes API)
- Mechanism: patch deployment annotation `kubectl.kubernetes.io/restartedAt=<timestamp>`
- Effect: triggers a rollout restart in a standard, observable way
- Executor location: `brain` (FastAPI) using Kubernetes Python client

#### B) ScaleDeployment (Kubernetes API)
- Mechanism: patch deployment replicas from current → current+1
- Guard: policy ensures +1 only
- Executor location: `brain` using Kubernetes Python client

#### C) BlockIP TTL (api-service internal endpoint)
- Mechanism:
  - `brain` calls `api-service`:
    - `POST /internal/block-ip` with `{ ip, ttlSeconds, reason }`
  - `api-service` denies requests in middleware based on denylist TTL
- Why MVP uses this:
  - safest and simplest; avoids iptables/envoy complexity pre-MVP

### Audit Requirements (required)
For every executed action, store:
- incident_id
- action_type
- input payload (typed)
- approval decision + policy reasoning
- execution result (API response / k8s patch response)
- timestamps (proposed → approved → executed)

---

## 4) Verification Loop (Close the Loop)

### Principle
An action is only “good” if it measurably fixes the problem.

### Verification Window (MVP)
- settle time: 15–30 seconds after execution
- verification time: up to 1–3 minutes
- check interval: every 15–30 seconds

### Checks by Incident Type
#### `SERVICE_DEGRADATION`
Pass if:
- 5xx rate drops below threshold and stays there for at least 2 consecutive checks
- optional: latency p95 returns below threshold

Fail if:
- still above threshold after the window

#### `AUTH_ABUSE`
Pass if:
- auth failure rate drops below threshold for at least 2 consecutive checks

Fail if:
- still above threshold after the window

### Outcome Rules (MVP)
- If verification passes:
  - incident status → `RESOLVED`
  - action verification_status → `PASSED`
- If verification fails:
  - incident stays `OPEN` (or mark `FAILED` if you want a terminal state)
  - action verification_status → `FAILED`
- **No automatic retries** in MVP (prevents thrash)

---

## 5) Observability (Minimum Viable)

### Goals (MVP)
- You can see: incident created → evidence attached → action executed → verification result
- You can prove: policy allowed/denied safely
- You can debug quickly

### Metrics (required)
From `api-service`:
- `http_requests_total{method,route,status}`
- `http_request_duration_seconds_bucket{...}` (or summary if you kept it)
- `auth_failures_total`
- `blocked_requests_total{route}`
- `denylist_size`

From `brain` (recommended):
- `detector_runs_total`
- `incidents_created_total{type}`
- `incidents_updated_total{type}`
- `actions_proposed_total{type}`
- `actions_executed_total{type,status}`
- `verification_pass_total{type}`
- `verification_fail_total{type}`

### Logs (required)
- `api-service`: structured JSON logs (client IP resolution, blocks, internal calls)
- `brain`: structured logs for:
  - detection decision (“threshold crossed” + numbers)
  - policy decisions (allow/deny + reason)
  - execution results (k8s response, internal API response)
  - verification outcomes

### Traces (optional MVP)
- OpenTelemetry traces are allowed but not required pre-MVP.
- If added: just enough to tie web request → brain endpoint → api-service internal call.

---

## 6) Kubernetes Deployment (Local)

### Cluster Choice
- Recommended: **k3d**
- Alternative: kind

### Required k8s Objects
- Deployments:
  - `api-service`
  - `brain`
  - `web`
  - `postgres`
  - `prometheus`
  - (optional) `otel-collector`
- Services: ClusterIP per component
- ConfigMaps:
  - Prometheus scrape config
  - brain config (thresholds, approval mode)
  - api-service config (internal API key, etc.)
- Secrets:
  - DB creds
  - internal API key

### Networking (MVP)
- Port-forward or k3d port mapping:
  - web → host:3000 (or 8080)
  - brain → host:8000 (optional)
  - prometheus → host:9090 (optional)

---

## 7) Runtime UX: Command Center

### Goal
A control room that makes the closed loop visible and operable.

### Minimum Screens
1) **Incident Feed**
- live list of incidents (polling or SSE)
- shows type, status, started_at, service, severity

2) **Incident Detail**
- evidence timeline (metrics snapshots at timestamps)
- AI investigation output (structured)
- proposed action (typed)
- policy evaluation result
- approval controls (Approve / Reject + reason)
- action + verification status

3) **Audit Log**
- chronological list:
  - incident created/updated
  - plan proposed
  - policy decision
  - action executed
  - verification passed/failed

### Real-Time Updates (MVP)
- Use **SSE** from `brain`:
  - `GET /stream/incidents`
- UI subscribes; updates incident list without refresh.

---