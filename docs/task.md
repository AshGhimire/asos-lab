# Tasks

- [ ] Phase 1: The Skeleton & The Victim (Auction App)
    - [x] **Infrastructure**: Initialize Monorepo & Makefile (Phase 0 migrated) <!-- id: 0 -->
    - [x] **Target App (`api-service`)**: Build "Cyber-Auction" with `/bid` & `/login` endpoints <!-- id: 1 -->
    - [x] **Target UI (`auction-ui`)**: Simple HTML/JS dashboard showing live fake bids <!-- id: 2 -->
    - [x] **Refactor**: Migrate Frontend to Vite (1 file at a time) <!-- id: 21 -->
    - [x] **Feature**: Implement Signup & JSON Persistence <!-- id: 22 -->
    - [x] **Brain (Skeleton)**: Setup Kopf (Python) and `kubernetes` client restart capability <!-- id: 3 -->
    - [x] **Integration**: `make up` runs everything in k3d <!-- id: 4 -->
    - [ ] **Verification**: Manual `make chaos` -> Manual `make rescue` works <!-- id: 5 -->

- [ ] Phase 2: The Reflex (Automated Loop)
    - [ ] **Telemetry**: Ensure Prometheus scrapes 5xx & auth failures <!-- id: 6 -->
    -   **Brain Operator**: Implement Kopf timer loop (Python) for 5xx spikes <!-- id: 7 -->
    - [ ] **Reflex**: Wire Detector -> Restarter (Hardcoded, no AI) <!-- id: 8 -->
    - [ ] **Verification**: `make chaos` resolves itself automatically <!-- id: 9 -->

- [ ] Phase 3: The Intelligence (AI & Policy)
    -   **AI**: Implement LLM Investigator (LangChain Python) <!-- id: 10 -->
    - [ ] **Scenario B**: Implement `make attack` (Credential Stuffing) <!-- id: 11 -->
    -   **RAG**: Implement pgvector storage & retrieval for past incidents <!-- id: 19 -->
    - [ ] **Policy**: Implement "Block IP" Executor & Safety Rules <!-- id: 12 -->
    - [ ] **Verification**: AI correctly identifies and blocks the attacker <!-- id: 13 -->

- [ ] Phase 4: The Command Center (UI)
    - [ ] **Backend**: Expose Incidents via SSE <!-- id: 14 -->
    - [ ] **Frontend**: Next.js Dashboard (Incidents, Evidence, Actions) <!-- id: 15 -->
    - [ ] **Verification**: UI updates in real-time during attack <!-- id: 16 -->

- [ ] Phase 5: Production Hardening
    - [ ] **Verification Loop**: Logic to confirm fixes actually worked <!-- id: 17 -->
    - [x] **Feature**: Implement Signup & JSON Persistence <!-- id: 22 -->
    - [ ] **Final Polish**: Docs, Audit Logs, Demos <!-- id: 18 -->
