# 01-implementation-plan.md
## Implementation Plan (Vertical Slices Strategy)

This plan prioritizes a **"Walking Skeleton"**: building a thin, end-to-end working loop first, then adding complexity (AI, UI) incrementally.


### Deliverables
2.  **The Brain Operator (Kopf)**:
    -   Use `kopf` framework to watch Prometheus metrics (via timer).
    -   Rule: `IF 5xx_rate > 0 THEN trigger_incident`.
3.  **The Reflex Execution**:
    -   Automatically calls the `restart` logic from Phase 1.
3.  **Evidence Storage**:
    -   Save the "Metric Snapshot" to Postgres when triggering.

### Done When
-   You run `make chaos` (break the app).
-   **Hands off the keyboard.**
-   The Brain detects it, logs "Restarting...", and the App comes back online within ~30 seconds.
-   **First dopamine hit acheived.**

---

## Phase 3: The Intelligence (AI Investigator)
### Goal
Replace the "dumb reflex" with an AI that *understands* what happened.

### Deliverables
1.  **AI Integration**:
    -   When Detector triggers, it pauses.
    -   Sends metrics + logs to LLM.
    -   LLM outputs: `{"diagnosis": "CrashLoop", "recommendation": "RestartDeployment"}`.
2.  **Policy Gate**:
    -   Code that checks: Is `confidence > 0.8`? Is action `Safe`?
70.  **RAG Integration (Grounding)**:
    -   Setup `pgvector` in Postgres.
    -   Brain queries past resolved incidents before asking LLM.
    -   Prompt includes: "Here is how we fixed similar issues in the past..."
71.  **Authentication Attack (Scenario B)**:
    -   Run a "Credential Stuffing" script.
    -   AI detects "Auth Failure Spike", recommends `BlockIP`.

### Done When
-   Running `make attack` triggers an investigation.
-   You see a JSON file/log where the AI explains *exactly* why it's blocking the IP.

---

## Phase 4: The Command Center (Web UI)
### Goal
Visualize the chaos in a "Mission Control" interface.

### Deliverables
1.  **Next.js Command Center**:
    -   **Live Feed**: Incoming incidents.
    -   **Trace View**: See the "Evidence" graphs the AI used.
    -   **Big Red Button**: "APPROVE" button for high-risk actions.
2.  **Real-time Stream**:
    -   SSE (Server Sent Events) from Brain to UI.

### Done When
-   You can watch the entire "Chaos -> Attack -> Defense" sequence on a beautiful dark-mode dashboard.

---

## Phase 5: Production Hardening (Verification)
### Goal
Prove it really worked (Verification Loop).

### Deliverables
1.  **Verification Logic**:
    -   After restarting/blocking, Brain watches metrics for 2 mins.
    -   Marks incident "RESOLVED" only if health returns.
105.  **Refactor: Ingress Blocking**:
    -   Move `BlockIP` logic from Middleware to Ingress/Gateway level for performance.
106.  **Audit Logs**:
    -   Full history of every robot decision.

### Done When
-   The full demo loop: Break it -> AI sees it -> AI fixes it -> AI verifies it -> AI closes ticket.
