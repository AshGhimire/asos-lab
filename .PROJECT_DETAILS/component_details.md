
---

## Component Details

## 1) api-service (Fastify, TS)
### Responsibilities
- Provide an intentionally breakable target service
- Expose metrics: request count, latency histogram, auth failures
- Implement denylist middleware with TTL (BlockIP action target)
- Provide internal endpoints for block/unblock/list denylist (API key protected)

### Key Endpoints (MVP)
- `GET /health` → ok
- `GET /metrics` → Prometheus scrape
- `POST /login` → auth endpoint that can be attacked (credential stuffing signal)
- `POST /internal/block-ip` → add denylist entry with TTL
- `POST /internal/unblock-ip`
- `GET /internal/denylist`

### Current Implementation Notes (matches your code)
- Denylist enforcement in `onRequest`:
  - Use `path = req.url.split("?")[0]` for allowlist reliability
  - Always `return` after `reply.send(...)` when blocking
- IP resolution:
  - `req.ip` (trustProxy aware) → preferred
  - `x-forwarded-for` only if socket peer is trusted (from your hardened `utils.ts`)
  - socket remote address fallback
- Allowlist:
  - `/health` and `/metrics` always pass, even when your IP is blocked

### Metrics (prom-client)
Recommended metric names (example):
- `http_requests_total{method,route,status}`
- `http_request_duration_seconds_bucket{...}`
- `blocked_requests_total{route}`
- `denylist_size` gauge
- `auth_failures_total{route}` (for AUTH_ABUSE detection)

---

## 2) brain (FastAPI, Python)
### Responsibilities
- Ingest normalized events (optional if using direct Prometheus queries only)
- Run detection loop: query Prometheus → create/update incidents
- Provide incident API for web UI
- Run investigation (LLM) to produce structured plan
- Apply policy gate decisions
- Execute approved actions via:
  - Kubernetes API (restart/scale)
  - api-service internal endpoint (block IP)
- Run verification loop and mark incidents resolved/not resolved
- Persist to Postgres + pgvector

### Internal Modules
- `detector.py` — Prometheus queries + threshold logic
- `models.py` — Pydantic schemas for Incident/Evidence/Action
- `policy.py` — hard rules engine
- `executors/k8s.py` — restart/scale
- `executors/api_service.py` — block IP via internal endpoint
- `verify.py` — post-action checks
- `rag.py` — retrieval (pgvector) optional

---

## 3) web (Next.js)
### Responsibilities
- Live incident feed (polling or SSE)
- Incident detail: evidence timeline + AI output + action proposal
- Approval workflow (Approve/Deny with reason)
- Audit log view (who approved what, when, why)
- Minimal: correctness > polish

### Real-time Updates (MVP)
- Prefer **SSE** over websockets:
  - `GET /stream/incidents` from brain
  - UI subscribes and updates list without refresh

---

## Data Model (Postgres) — Minimal & Typed
### Tables
**incidents**
- one row per incident; status transitions tracked

**evidence**
- snapshots of metrics/logs linked to incidents

**actions**
- proposed + executed actions, policy decisions, outcomes

**events** (optional MVP-lite)
- normalized event ingestion if you choose log/event pipeline

### SQL Schema (MVP)
```sql
-- incidents
create table if not exists incidents (
  id uuid primary key,
  type text not null check (type in ('SERVICE_DEGRADATION','AUTH_ABUSE')),
  status text not null check (status in ('OPEN','MITIGATED','RESOLVED','FAILED')),
  service text not null,
  started_at timestamptz not null,
  last_updated_at timestamptz not null,
  summary text,
  severity int not null default 2, -- 1 low, 2 med, 3 high
  dedupe_key text not null,
  closed_at timestamptz
);

create unique index if not exists incidents_dedupe_idx on incidents(dedupe_key) where status in ('OPEN','MITIGATED');

-- evidence
create table if not exists evidence (
  id uuid primary key,
  incident_id uuid not null references incidents(id) on delete cascade,
  ts timestamptz not null,
  kind text not null check (kind in ('METRIC','LOG','TRACE','STATE')),
  source text not null,            -- e.g. prometheus query name or log source
  payload jsonb not null           -- store query + results or log excerpt
);

create index if not exists evidence_incident_ts_idx on evidence(incident_id, ts);

-- actions
create table if not exists actions (
  id uuid primary key,
  incident_id uuid not null references incidents(id) on delete cascade,
  ts timestamptz not null,
  action_type text not null check (action_type in ('RestartDeployment','ScaleDeployment','BlockIP')),
  proposed_by text not null check (proposed_by in ('AI','HUMAN','SYSTEM')),
  approved boolean,
  approval_mode text not null check (approval_mode in ('RECOMMEND','AUTO')),
  policy_reason text,
  input jsonb not null,            -- typed action payload
  execution_status text not null check (execution_status in ('PENDING','EXECUTED','FAILED','SKIPPED')),
  execution_result jsonb,          -- stdout-like info, k8s response, etc.
  verification_status text not null default 'PENDING' check (verification_status in ('PENDING','PASSED','FAILED')),
  verification_result jsonb
);

create index if not exists actions_incident_ts_idx on actions(incident_id, ts);

-- (optional) events
create table if not exists events (
  id uuid primary key,
  ts timestamptz not null,
  service text not null,
  kind text not null,              -- e.g. HTTP_METRIC, AUTH_FAILURE, POD_RESTART
  payload jsonb not null
);

create index if not exists events_service_ts_idx on events(service, ts);

Optional: pgvector for similar-incident retrieval

Store embeddings for incident summaries or resolution notes:

-- requires pgvector extension
create extension if not exists vector;

create table if not exists incident_vectors (
  incident_id uuid primary key references incidents(id) on delete cascade,
  embedding vector(1536),          -- depends on model
  text text not null
);
