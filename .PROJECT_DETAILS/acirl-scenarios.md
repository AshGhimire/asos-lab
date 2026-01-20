# 03-acirl-scenarios.md
## ACIRL Scenarios (Reproducible Demos)

This file defines the **two canonical MVP scenarios** that prove the closed-loop system works end-to-end.

**Rule:** If these two scenarios don’t work perfectly and repeatably, stop and fix the system before adding anything else.

---

## Scenario A — CrashLoop Failure (SERVICE_DEGRADATION)

### Purpose
Prove the system can detect a real service failure, investigate, safely restart the service, and verify recovery.

### What You Intentionally Break
`api-service` is forced into a CrashLoop-like failure mode.

### Injection Mechanisms (pick one for MVP)
**Option 1: Bad config causes startup crash (recommended)**
- `api-service` reads an env var (e.g., `CRASH_ON_BOOT=1`)
- If set, it throws on startup

**Option 2: Bad ConfigMap triggers runtime crash**
- app reads config periodically
- invalid config causes exit

**Option 3: Deploy a “broken” image**
- change image tag to a version that exits immediately

### Expected Telemetry Pattern
- `http_requests_total` may flatten or shift
- 5xx rate spikes (or service becomes unavailable)
- latency may spike before failure
- logs show restart or crash messages

### Detection Outcome
- `brain` opens a `SERVICE_DEGRADATION` incident
- attaches evidence snapshots:
  - 5xx rate query + results
  - request rate (optional)
  - latency p95 (optional)

### Investigation Outcome (AI)
- produces:
  - hypothesis: “service crash / restart loop / bad config”
  - plan: `RestartDeployment` for `api-service`

### Policy Outcome
- `RestartDeployment` allowed
- if AUTO mode enabled, can auto-execute for this incident type (optional)

### Execution Outcome
- `brain` patches deployment annotation to trigger restart
- action is logged (inputs + results)

### Verification Outcome
- re-query Prometheus:
  - 5xx rate below threshold
  - latency stabilizes (optional)
- incident marked `RESOLVED` if checks pass

### Pass/Fail Criteria
**PASS** if:
- incident created
- action executed
- metrics return below threshold within the window
- incident transitions to `RESOLVED`

**FAIL** if:
- incident never created OR
- action executes but metrics don’t recover within window OR
- system cannot show evidence → decision → action → verification chain

---

## Scenario B — Credential Stuffing (AUTH_ABUSE)

### Purpose
Prove the system detects auth abuse, proposes a safe IP block with TTL, enforces it, and verifies the abuse signal drops.

### What You Intentionally Attack
`api-service` login endpoint is hammered with invalid credentials.

### Attack Script Behavior (MVP)
- Send repeated `POST /login` requests with wrong password
- Do it from a consistent source IP (localhost is acceptable in MVP)

### Required Instrumentation
`api-service` must increment an auth failure metric, e.g.:
- `auth_failures_total{service="api-service"}`

### Expected Telemetry Pattern
- `auth_failures_total` rate spikes
- potentially increased total request rate
- logs show repeated failed login attempts

### Detection Outcome
- `brain` opens an `AUTH_ABUSE` incident
- attaches evidence snapshots:
  - auth failure rate query + results

### Investigation Outcome (AI)
- hypothesis: “credential stuffing / brute force”
- plan: `BlockIP` with TTL (e.g., 60s–300s)
- must include confidence value

### Policy Outcome
- `BlockIP` allowed only if confidence ≥ 0.80 and TTL within max
- default requires approval in UI

### Execution Outcome
- `brain` calls:
  - `POST api-service/internal/block-ip`
- `api-service` denylist middleware blocks subsequent requests from that IP

### Verification Outcome
- auth failures rate drops below threshold after the block
- incident marked `RESOLVED` if checks pass

### Pass/Fail Criteria
**PASS** if:
- incident created
- block action executed (with TTL)
- auth failure rate drops below threshold within the window
- incident transitions to `RESOLVED`

**FAIL** if:
- block doesn’t apply (IP mismatch / no normalization)
- allowlist accidentally blocks `/metrics` and breaks observation
- verification cannot prove drop in auth failures

---

## Reproducibility Requirements (MVP)
To count as a valid demo, each scenario must be runnable via one command and observable live.

### Suggested Make Targets
- `make chaos` → runs Scenario A injection
- `make attack` → runs Scenario B attack script
---
