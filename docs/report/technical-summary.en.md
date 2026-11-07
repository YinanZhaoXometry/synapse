# Synapse Technical Summary (Report/PPT Source · English)

> Purpose: technical source material for the COMP5241 course report and slides. Quick-card format: each card = **one-line claim** → supporting detail → citable numbers (with sources).
> Numbers as of 2026-11-07 (main @ `1c3d6c0`).

---

## 1. Overview Card

**One-liner**: Synapse is a bilingual (Chinese/English) AI-guided study platform — the system supplies the study plan, users bring their own materials, and mastery is driven only by quiz evidence; built as a full-stack monorepo by a solo developer working with AI agents, delivered from zero in ~6.5 days.

| Dimension | Fact | Source |
|---|---|---|
| Delivery pace | First commit 2026-11-01 → 11-07: **~6.5 days / 534 commits on main** | `git rev-list --count main` |
| Phases | 3 delivery phases · **25+ epics** (Phase 1 local static prototype: 6; Phase 2 server-ization: 16; Phase 3 optimization season: 10, of which 7 shipped/in review) | `.scratch/phase-{1,2,3}/` |
| Frontend stack | Vite 5 · React 18 · TypeScript · shadcn/ui (46 components) · Tailwind 3 · Apollo Client 4 | `frontend/` |
| Backend stack | Rails 8.1.4 (API-only) · graphql-ruby ~2.5 · puma · Solid Queue · Postgres 17 | `backend/AGENTS.md` |
| API surface | GraphQL: **Query 35 + Mutation 43 = 78 root operations**; schema 5,334 lines / 93 object types / 72 inputs | `backend/schema.graphql` |
| Backend scale | Command layer: **65 command classes (incl. base classes) / 17 bounded-context dirs** | `backend/app/commands/` |
| Tests | RSpec latest recorded baseline **1,474** examples · Vitest **~980+** (111 test files) · Playwright e2e **26 tests / 6 spec files** | Epic close-out status lines + static counts |
| Coverage floors | Backend SimpleCov line floor **96%** · Frontend v8 thresholds lines 65 / branches 83 / functions 77 | `backend/spec/spec_helper.rb` · `frontend/vitest.config.ts` |
| Performance | Entry bundle **1,026 KB → 724 KB (−29.5% min / −26.6% gzip)**, with an 800 KB CI tripwire | `.scratch/phase-3/epic-19-bundle-split/bundle-report.md` |
| i18n | **904 keys × zh/en**, full-table parity pinned by a dedicated test | `frontend/src/contexts/i18n-dictionary.ts` |
| Design system | **167 CSS variables / 8 token groups** (incl. learning-state semantics) · 3 palettes × 3 modes | `frontend/src/index.css` |

---

## 2. Architecture Overview

### 2.1 Deployment topology (the free-tier quartet)

**Claim: a "static frontend + single-container API + no Redis + direct-to-object-storage upload" free-tier architecture — finalized at design time (architecture spine), not improvised at deploy time.**

```
Browser SPA ──(Cloudflare Pages, static + _redirects SPA fallback)
   │  POST /graphql        (business surface)
   │  GET  /api/stream     (SSE, AI streaming — the single non-GraphQL surface)
   ▼
Render single Docker web service (Rails 8.1, puma + Solid Queue in-process, health /up)
   ├── Neon Postgres 17 (direct connection, non-pooler)
   └── Cloudflare R2 (material blobs; dev/test use a compose minio stand-in)
```

- The backend exposes **exactly 3 routes**: `POST /graphql`, `GET /api/stream`, `GET /up` (`backend/config/routes.rb`) — a minimal attack and maintenance surface.
- Why it matters: free-tier constraints (no worker process, no Redis, no keep-alive) were written into the architecture spine as AD-20 up front, and they shaped every technical choice (see §3.5/§3.6).

### 2.2 Frontend layering (four seams, one-way dependencies)

**Claim: a ports-and-adapters-in-the-small SPA — routes/features touch domain data only through a typed hooks layer; domain logic is pure and mandatorily tested.**

| Layer | Responsibility | Key file |
|---|---|---|
| `src/apollo/` | Apollo Client 4 singleton: auth link + relative `/graphql`; `resetApiClient()` is the **single** cache-wipe + SSE-termination channel for login/logout/account switches | `frontend/src/apollo/client.ts` |
| `src/api/` | Typed hooks layer (the only data entrance for features): **34 query + 42 mutation documents** → codegen → committed TypedDocumentNodes; server mastery fields are read-only, never recomputed (AD-14) | `frontend/src/api/index.ts` |
| `src/domain/` | Pure domain logic: mastery (ADR-0001 rules), streak, entities, annotation ranges, today/week keys — **Vitest coverage mandatory** (AD-10) | `frontend/src/domain/mastery.ts` |
| `src/ai/` | AI seam: SSE client + server adapter + simulated implementation (deterministic dev/test double) | `frontend/src/ai/sse-client.ts` |

### 2.3 Backend command core

**Claim: every use case is a command class; resolvers degenerate into four-step glue; errors form a closed enum mirrored 1:1 across stacks.**

- **Command-layer-first (AD-12)**: `ApplicationCommand` (dry-initializer + dry-monads Result); business logic never raises. A resolver does only: parse args → authorize → call command → map Result. Plain SELECTs may read scoped associations directly (bare-read exemption); anything with a decision must be a command.
- **Closed error enum**: `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` (`backend/app/commands/application_errors.rb`) → GraphQL `extensions.code` → frontend `AppError` 1:1 mirror (`frontend/src/api/errors.ts`) → i18n copy → toast. The whole error pipeline is enumerable and testable.
- GraphQL hygiene: Dataloader batching, `max_query_string_tokens(5000)`, `validate_max_errors(100)`, no Relay/global node IDs.
- Auth: JWT HS256, 24h TTL (`backend/app/lib/accounts/token_codec.rb`); login rate limit 10 attempts / 60s.

### 2.4 The architecture spine: 20 numbered decisions

**Claim: every major technical decision is frozen in the spine as AD-1..AD-20; tickets must cite AD ids — decisions stay traceable and drift-free.**

- **AD-1..11 (Phase-1 static era)**: domain core + two seams; module boundaries; versioned local document; AI seam; mastery as a pure function; client-side document rendering; routing front door; scaffold conventions; testing posture; static deployment.
- **AD-12..20 (Phase-2 server era)**: GraphQL-first command core; server data model; mastery computation moves home; JWT accounts; AI executes server-side with one SSE surface; monorepo; Apollo swap; Solid Queue; deployment envelope.
- Source: `docs/architecture/architecture-synapse/architecture-synapse.md`; AD ids are cited continuously across tickets (`.scratch/phase-*/epic-*/`).

---

## 3. Key Design Decisions (quick cards)

### 3.1 ADR-0001: mastery is one pure function

**Claim: Mastery Score = windowed mean of the last 5 evidence items; fewer than 3 evidence items caps the score at 99; plan rollup uses floor; a 14-day freshness cap — one implementation, pinned by golden vectors, never computed twice.**

- Rule constants live in `MASTERY_CONFIG` (window 5 / gate 3 / threshold 80 / partial 0.5 / freshnessDays 14).
- `backend/app/lib/mastery.rb` is the **single** implementation, pinned case-by-case by **41 golden-vector cases** (`backend/spec/fixtures/mastery_vectors.json`); the frontend renders server scores only (AD-14).
- "Mark as mastered" (claim) **never moves the score** — only quiz evidence does. The technical foundation of product honesty.
- All 4 amendments are recorded in `docs/adr/0001-mastery-computation.md` (accepted 2026-11-02).

### 3.2 schema.graphql: the only cross-stack contract + codegen anti-drift

**Claim: the two stacks in the monorepo align on exactly one artifact — a schema IDL committed to the repo; CI regenerates and diffs, so drift fails loudly.**

- `backend/schema.graphql` (IDL-only, dumped via `graphql:schema:dump`) is the only contract surface; idempotency is asserted by a double-dump spec.
- The frontend's `npm run codegen` produces TypedDocumentNodes (output committed, hand-edits forbidden); CI and `just spec` both run "regenerate + `git diff --exit-code`" — schema drift is always caught before merge.

### 3.3 The AI surface: a provider-neutral seam + one SSE streaming channel

**Claim: AI capability hangs off an OpenAI-compatible provider seam (switching providers = changing env vars, not code); streaming rides the single SSE channel outside GraphQL, authenticated by one-time tickets.**

- The configuration surface is four environment variables: `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_TIMEOUT_SECONDS` (unified with the `AI_DAILY_CALL_CAP` family); the client is hand-rolled on Ruby stdlib Net::HTTP (`backend/app/lib/ai/`, 11 files: provider seam / client / 8k-token context assembler / prompts / response parser / tagged-protocol splitter).
- **Daily cap**: 50 calls/user/UTC-day, atomic Postgres `INSERT…ON CONFLICT` counters; the settings page shows an honest "N of cap today" readout.
- **SSE tickets**: the `createStreamTicket` mutation mints a 60s-TTL single-use opaque ticket (max 10 live) → consumed at `GET /api/stream?ticket=…` (ActionController::Live); event vocabulary `rung → token* → citation → terminal` with a closed terminal-code enum; tickets are unreplayable and mismatched ones get 401; the frontend **never auto-reconnects** — a remint means a full restart that counts against the daily cap.
- Why it matters: streaming — the need GraphQL cannot express — is confined to one surface with a one-shot-ticket auth model that is simple and testable.

### 3.4 Storage: presigned direct uploads; the API never touches file bytes

**Claim: material files never pass through Rails — the server only mints presigned URLs and the browser uploads straight to object storage; upload/download TTLs are separate; ActiveStorage REST routes are never mounted.**

- Upload: `createMaterialUpload` mints a v4 presigned **PUT** (15-minute TTL, signature covers the declared content type; backend cap 100 MB per file, frontend validates 20 MB for PDF/MD); key convention `materials/{user_id}/{uuid}{ext}`.
- Download: a fresh 5-minute presigned **GET** per request; URLs are never persisted (`backend/app/commands/storage.rb`).
- dev/test use compose minio as the object-storage stand-in; prod is R2 (4 `R2_*` env vars, fail-fast if missing); "ActiveStorage REST routes never mounted" is pinned by a route-guard spec.

### 3.5 All durable state converges on Postgres (no Redis)

**Claim: job queue, scheduling, daily counters — all durable state lives in Postgres. The entire system is "one stateless container + one database + one object store"; no Redis/Sidekiq/separate workers.**

- Solid Queue is **DB-backed and in-process with puma** (`SOLID_QUEUE_IN_PUMA=1`): a single named job `due_scan` scans for due reviews every 10 minutes (FR-24); worker concurrency 1.
- **Connection-pool arithmetic** (free-tier critical): puma web 3 + queue worker 1 + dispatcher 1 = **5 = AR pool**, deliberately not setting `RAILS_MAX_THREADS` — five connections, exactly enough, not one more (`docs/deploy.md` §10).
- AI daily-cap counters and the login rate limiter likewise have no external dependencies.
- Why it matters: one fewer service = one fewer thing to operate, pay for, and debug; backup and migration have a single point; background jobs remain possible under a "single web service" free-tier limit.

### 3.6 Deployment-conscious architectural flexibility

**Claim: the production shape (Cloudflare Pages · Render · Neon · R2 free tiers) was fixed in the architecture spine (AD-20) before the first line of business code; development convenience and deployment convenience were treated as equal design constraints.**

- Free-tier constraints shaped choices in reverse: no Redis (→ Solid Queue in-process), no worker service (→ single container), no keep-alive (→ accept ~1-minute cold starts; a keep-alive ping loop + 1s queue polling would burn Neon's ~191 hours of free compute in ~8 days — the decision is protected against regression by a **lexical guard spec**, `backend/spec/config/no_keep_alive_spec.rb`).
- Development convenience got equal treatment: a single root `justfile` entrypoint (`just setup/dev/up/spec/e2e`); one compose command brings up postgres+minio+api; dev-only dotenv gives bare `just up` AI out of the box; the README takes a fresh machine from zero to running.
- A full rollback drill manual ships with the repo (`docs/deploy.md` §9, rollback point `373e138`) plus an idempotent demo-account seed.

---

## 4. Key Difficulties (full-spectrum quick cards: problem → root cause → solution → evidence)

> Each card supports a 1–2 minute telling; the "evidence" column points at files you can open live.

### 4.1 Cross-stack computation anti-drift: golden vectors + stamp-insensitive diff

- **Problem**: mastery rules are consumed by both the TS domain and the Ruby backend — how do you prove they never diverge?
- **Root cause**: two implementations drift by nature; worse, the vector fixture is produced by the TS generator and carries a self-referential generation stamp — any vector-extending commit leaves a stale stamp behind, so a naive diff is always red (this burned us twice).
- **Solution**: the TS domain is the **single source of truth**, generating a committed 41-case golden-vector fixture; `just spec` and CI both run "regenerate → strip stamp on both sides → diff" (stamp-insensitive) — comparing content, never timestamps.
- **Evidence**: `justfile` (web-test recipe) · `.github/workflows/ci.yml` ("Mastery vector anti-drift" step) · `backend/spec/fixtures/mastery_vectors.json`.

### 4.2 The SSE-vs-GraphQL tension: one-time tickets

- **Problem**: Companion chat and plan generation need token-level streaming; GraphQL mutations can't stream.
- **Root cause**: GraphQL over HTTP is request-response; and EventSource cannot carry custom auth headers.
- **Solution**: `createStreamTicket` mints a 60s one-time ticket inside GraphQL → consumed at `GET /api/stream?ticket=`; tickets are unreplayable, mismatches get 401; the CORS initializer allowlists exactly this one path.
- **Evidence**: `backend/app/controllers/api/stream_controller.rb` · `backend/app/commands/ai/create_stream_ticket_command.rb` · `frontend/src/ai/sse-client.ts`.

### 4.3 ADR-0001's three self-corrections (caught by TDD)

- **Problem**: the first ruleset failed edge cases — (1) 1–2 evidence items could display 100; (2) `Math.round((100+99)/2)=100` broke the "100% ⇔ every node truly mastered" invariant; (3) percentage-decay freshness was semantically vague.
- **Solution**: (1) an evidence gate (<3 items caps at 99); (2) rollup switched to `Math.floor`; (3) a hard 14-day freshness cap (latest evidence older than 14 days caps at 99 and never reaches "mastered"). All three were forced out by tests/golden vectors and recorded as ADR amendments.
- **Evidence**: `docs/adr/0001-mastery-computation.md` (4 amendments).

### 4.4 Pointer-events implicit capture retargeting (a known W3C defect)

- **Problem**: after shipping touch gestures (two-finger canvas zoom, swipe-to-close drawer), taps got swallowed.
- **Root cause**: W3C pointerevents#356 — implicit pointer capture redirects subsequent events to the capturing element; and jsdom cannot simulate this behavior at all (a unit-test blind spot).
- **Solution**: move `setPointerCapture` from `pointerdown` to the **gesture-confirmation (ENGAGE) moment**; add real-Chromium touch smoke tests, which also caught a second bug — entry-animation replay eating taps.
- **Evidence**: `.scratch/phase-3/epic-20-touch-batch/` (epic status line records the W3C id) · `frontend/src/features/plans/` (RoadmapGraph gestures) · `frontend/src/components/layout/AppLayout` (drawer gestures).

### 4.5 UUID crash on non-secure contexts

- **Problem**: during LAN-IP demos (http://192.168.x.x:8080), uploads/creates failed silently.
- **Root cause**: `crypto.randomUUID` exists only in secure contexts (HTTPS/localhost); on insecure origins it is `undefined`.
- **Solution**: a single choke point `newClientUuid()` — use `randomUUID` when present, otherwise assemble an RFC 4122 v4 by hand from 16 `getRandomValues` bytes (version/variant bits set); 6 call sites converged onto it.
- **Evidence**: `frontend/src/lib/uuid.ts` (with tests).

### 4.6 MinIO images dead on every registry → build from source

- **Problem**: the local/CI object-storage stand-in wouldn't start — the pinned minio image returned 401/403/410 on docker.io / quay / ghcr / dl.min.io — **everywhere**.
- **Root cause**: after MinIO archived its community distribution, old tags were progressively reclaimed across registries; even the official Dockerfile pointed at the same dead source; compounded by DNS pollution on the local network.
- **Solution**: both CI and dev now **compile minio + mc from a pinned release tag** and assemble a minimal runtime image with only curl/mc; each stage is its own RUN layer for breakpoint retries; built-in `SYNAPSE_GOPROXY` / `SYNAPSE_DOCKER_MIRROR` escape hatches for polluted networks.
- **Evidence**: `backend/.dockerdev/Dockerfile.minio` · `.github/workflows/ci.yml` (backend job).

### 4.7 The CI YAML block-scalar trap

- **Problem**: after editing ci.yml, a CI job went red "in 0 seconds with no logs".
- **Root cause**: a newly inserted line at column 0 continued the block scalar (`run: |`) and severed it — YAML semantics changed silently.
- **Solution/lesson**: validate every ci.yml change with a local python-yaml parse; treat "watch shows no checks / exit-0" as a red flag.
- **Evidence**: `.github/workflows/ci.yml` (verified after fix); lesson recorded in `.scratch/phase-3/epic-19-bundle-split/`.

### 4.8 Deterministic e2e: an OpenAI-compatible stub provider

- **Problem**: CI runs of the critical flows cannot depend on live AI — irreproducible, costly, network-dependent.
- **Solution**: a harness-only **OpenAI-compatible stub server**: identifies prompt shape by stable opening lines and returns frozen responses (the 16-node roadmap proposal deliberately includes one illegal back-edge to prove server-side validation); quiz question ids are regex-extracted from context — fabricated ids fail loudly on server normalization rather than passing silently; SSE is simulated with `data:{json}` + `[DONE]`.
- **Evidence**: `frontend/e2e/stub-provider.mjs` · `backend/.dockerdev/compose.e2e.yaml` (points the provider base_url at the stub).

### 4.9 Bundle slimming: measure first, then split

- **Problem**: the entry chunk was 1,026 KB (min) — pdfjs/recharts shipped in full with the entry.
- **Solution**: baseline report first, then one uniform idiom — **every in-shell route declares `React.lazy` at its declaration site** (reader/pdfjs loads only when someone actually reads); CI gained a dist size summary + `chunkSizeWarningLimit: 800` tripwire; the dead framer-motion dependency was removed along the way.
- **Result**: entry 723,680 B (**−29.5% min / −26.6% gzip**).
- **Evidence**: `frontend/src/App.tsx` · `.scratch/phase-3/epic-19-bundle-split/bundle-report.md` · `frontend/vite.config.ts`.

### 4.10 A conflict protocol for parallel worktrees

- **Problem**: multiple epics in flight while the owner manually tests on main — ports, test databases, and the demo stack trampled each other.
- **Solution**: **all implementation happens in dedicated git worktrees** (owner ruling, codified in `docs/agents/workflow.md`); worktrees bootstrap from zero (frozen installs, dedicated ports, compose `-p` project names); merge = delete the worktree and branch; a shared conflict checklist is maintained (ports 8080/3000, postgres test DBs, `just e2e`, dev DB data).
- **Evidence**: `docs/agents/workflow.md` §Implementation worktree discipline · epic status lines across `.scratch/`.

---

## 5. Quality Assurance System

**Claim: three test layers + a three-job CI + a family of "guard tests" — quality gates are merge conditions, not afterthoughts.**

| Layer | Scale | Gate |
|---|---|---|
| RSpec (backend) | Recorded baseline **1,474** examples / 140 spec files | SimpleCov line floor **96%** (a red floor = a red build) |
| Vitest (frontend) | **~980+** tests / 114 files | Coverage thresholds lines 65 / branches 83 / functions 77 (a ~2-point ratchet above the floors, below actuals) |
| Playwright e2e | **26 tests / 6 spec files** | A **merge gate** since epic-17; stub AI provider — no key, no network |

- **The `just spec` chain**: codegen+diff → `tsc -b` → eslint → vitest --coverage → vite build → mastery anti-drift → rubocop → rspec.
- **CI: three jobs** (push/PR to main + `epic/**`): frontend / backend (postgres:17 service + source-compiled minio) / e2e (needs both; uploads report/traces on failure).
- **The guard-test family** (tests that lock architectural conventions against regression):
  - architecture guard: greps that the deleted `UserProgressContext` is never imported again (`frontend/src/test/architecture.guard.test.ts`);
  - route guard: ActiveStorage REST routes stay unmounted;
  - no-keep-alive lexical guard: the free-tier posture can't be "optimized" away;
  - i18n full-table parity: 904 keys × zh/en — one missing side turns CI red (`frontend/src/contexts/i18n-full-parity.test.ts`);
  - schema-dump idempotency, mastery anti-drift, bundle tripwire (see §4.1/§4.9).
- **Two-axis code review per epic** (axis A ship-ability / axis B fix-first); findings and fixes are recorded in the epic's close-out status line — the reviews themselves leave an audit trail.

---

## 6. Development Process & Engineering Methodology (key chapter)

> Core narrative: **the owner holds the decision gates; AI agents execute to spec.** Direction, acceptance, and trade-offs were all human decisions; implementation ran through a spec-driven pipeline. And the methodology itself was iterated mid-project (§6.1).

### 6.1 Methodology self-evolution: from full BMAD autonomy to a dual toolchain

**Claim: the old project's "one epic = one giant ticket, agent runs overnight autonomously" approach was deliberately retired in favor of this project's "BMAD owns product thinking × the Matt chain owns implementation" — granularity dropped from epic-level to ticket-level, and the feedback loop from hours to minutes.**

| Dimension | v0 (old project, BMAD-only) | v1 (this project, BMAD × Matt) |
|---|---|---|
| Ticket granularity | 1 epic = 1 big feature, handed wholesale to an autonomous dev agent | Each epic splits into 3–6 vertical-slice tickets; one ticket closes in one session |
| Single run | Agents ran all night (6-hour scale) without converging | A ticket completes in hours, including TDD + review |
| Quota burn | Very fast (long sessions, repeated trial-and-error) | Controllable (short sessions, dense human decision gates) |
| Feedback loop | Mistakes surfaced hours later; rework expensive | Every ticket passes grill/review; drift corrected within the ticket |
| Human role | Mostly spectator | Decision gates: answering questions, rulings, acceptance |

- **The dual-toolchain split** (codified in `docs/agents/workflow.md`): BMAD owns product thinking (brief → PRD → UX → architecture spine); Matt Pocock's skills own implementation (grill → to-spec → to-tickets → tdd/implement → code-review); the two chains never run on the same artifact.
- **Scale-based routing**: small changes go straight to tdd; a single feature runs brief→grill→spec→tickets; only large multi-epic efforts require the full architecture chain.

### 6.2 Upfront product work is the foundation

**Claim: brief → PRD (46 FRs) → UX spine → architecture spine (20 ADs) were all finalized before business code; the clearer the front-loading, the less the drift — the foundation determines the building.**

- The documentation pipeline (finalized 2026-11-01): `docs/product/brief-synapse/` → `docs/product/prd-synapse/` (46 functional requirements) → `docs/design/ux-synapse/` (IA table, tone table, behavior bible, **anti-pattern list**) → `docs/architecture/architecture-synapse/` (20 numbered ADs).
- **Traceability**: every ticket cites FR ids and AD ids; the PRD §6.2 ↔ delivered diff-check ran at Phase-2 open and close (10 of 14 lines clean; 4 survivors explicitly reconciled into the Deferred table with revival triggers) — "no drift" was proven by reconciliation, not claimed.
- The spine-vs-code `gap-analysis.md` directly produced Phase-1's epic slice list — gap analysis became the construction plan.

### 6.3 The design workflow: Lovable → OpenDesign (Arc) → token contract → React

**Claim: the visual system wasn't drawn — it was generated: an AI design tool produced the spec, and the codebase received it as a token contract. Lovable generated a runnable base; the Arc Browser design system was selected in OpenDesign to produce the Northstar visuals; then it was mapped pass by pass into the shadcn/HSL token system.**

The four-step chain (every step backed by primary evidence in the repo and the tool):

1. **Lovable generates the frame (11-01, `e3d2897`)**: from the product idea, a complete runnable SPA base in one import — 101 files / +14,969 lines: the 50-piece shadcn/ui set, Tailwind + HSL tokens, 13 page frames, i18n/theme contexts. A running starting point within hours, not an empty repo.
2. **OpenDesign + selected design system produce Northstar (11-02)**: in OpenDesign (an open-source, local-first AI design workspace with a 150+ design-system catalog), the **Arc Browser design system** was selected (tool-side evidence: 21 design runs all bound to `designSystemId:"arc"`; the chat log preserves the explicit `@Arc Browser` selection; contrast: the previous archived project ran on a different bundled "claude" DS). The design runs produced the Northstar multi-screen prototype (four key screens: plans-home / plan-home / reader-companion / quiz) and `northstar-reference.html` (the visual source of the sunset/twilight/aurora palettes + dark mode); exports carried an OD-LAYOUT-PRIMITIVES layout layer.
3. **Structured import (`229716d` "feat: added design system")**: `docs/design/northstar-import/IMPORT.md` maps the Northstar prototype into shadcn/HSL tokens across **12 sections and 8 passes** — landing as **167 CSS variables in 8 groups** (shadcn semantics, brand gradient, glass system, accent tints, elevation, ink colors, **learning-state semantics** (mastered/partial/citation/four annotation colors), chart & sidebar).
4. **Full prototype port (`cba60ac`)**: the Northstar prototype became the React implementation, later evolving into the runtime theme system (hot palette switching, dark accent auto-lightening of 14%/30%).

Methodological takeaways (two sentences for the report):
- **The AI design tool owns generating the visual spec; the codebase receives it as a token contract** — the visual source of truth (northstar-import/) and the behavioral source of truth (ux-synapse/EXPERIENCE.md) stay separate, each with a single source.
- Tool residue was engineered away too: the Lovable tagger plugin remains were explicitly removed on 11-06 (`c24b67a`).

### 6.4 Human–AI division of labor: owner decision gates + agents executing to spec + two-axis review

**Claim: the human owns direction and acceptance (all on the record); agents implement to spec — every epic's tickets, review findings, fixes, test baselines, and CI run numbers are logged, making the whole process auditable.**

- **Three kinds of owner decision gates**:
  1. **Grill rounds**: at the start of each epic, a questioning round (agent asks with recommended answers; the human decides);
  2. **Rulings**: the worktree discipline, the env rename (`PROVIDER_*`→`AI_*`), the return to npm — key trade-offs were decided by the owner and codified;
  3. **Vetoes**: the roadmap.sh import was ruled WONTFIX over content licensing (no redistribution, no permission-seeking; outbound links stay) — scope reduction is a decision too.
- **Agent execution discipline**: implementation always in a dedicated worktree; TDD; conformance to the root and backend AGENTS.md contracts; tickets carry acceptance criteria.
- **Two-axis review**: before every epic merge, axis A (ship-ability) and axis B (fix-first) run; P1/P2 findings and fixes are recorded in the epic close-out status line (with branch SHA, test baselines, CI run id).

### 6.5 Delivery cadence and the board

**Claim: three phases, 25+ epics, ~6.5 days — the rhythm was driven by a local markdown ticket board with no external tooling.**

| Phase | Dates | Theme | Epics |
|---|---|---|---|
| 1 | 11-02 → 11-03 | Local-first static prototype (Nov-6 course line) | 6 (foundation/plans/reader/tasks/quiz-flashcards/small-tail) |
| 2 | 11-03 → 11-06 | Server-ization: Rails API + Apollo cutover + full feature land | 16 (monorepo→api-foundation→auth→…→marking-ui) |
| 3 | 11-06 → | Optimization season (no new PRD scope) | 10 (7 shipped/in review: roadmap graph, test hardening, hub tails, bundle split, touch batch, reader-companion UX, tutor threads [PR #23 in review]; 3 queued) |

- Ticket board: `.scratch/phase-<N>/epic-<NN>-<slug>/` local markdown with `Status:`/`Blocked by:` lines and five-role triage labels.
- Rhythm notes: Phase-2 ran a hard sequence 00→01→02→03→05→08 (the cutover), after which feature epics opened in parallel; Phase 3 ran single-lane with a delta-grill at each epic kickoff.

---

## 7. Deployment & Free-Tier Engineering

**Claim: the whole site runs on four free tiers (Cloudflare Pages + Render + Neon + R2) — the free tier is not a degraded compromise but an explicitly engineered constraint set.**

- Frontend: CF Pages static hosting, `_redirects` SPA fallback; the only build-time env is the API URL.
- API: a Render single Docker web service (`render.yaml`, health `/up`, autoDeploy on main).
- **The cold-start arithmetic**: deliberately no keep-alive — a ping loop + Solid Queue's 1s polling would burn Neon's ~191 free compute-hours in ~8 days; the ~1-minute cold start is accepted, with a temporary paid upgrade before demo windows (and a full rollback drill manual).
- Neon requires a direct (non-pooler) connection: Solid Queue polling cannot tolerate transaction-level pooling.
- Demo account: idempotently seeded at every boot (`backend/app/lib/demo_seed.rb`) — zero-preparation demos.

---

## 8. Known Gaps / Future Work (honest list)

- **Queued epics**: flashcard flip motion (spec'd and ticketed), the roadmap drag-and-drop editor (the largest, saved for last), two-stage AI proposal-quality lift.
- **e2e boundary**: AI-gated surfaces (companion, open/mix quiz, notes, flashcard generation) deliberately stay out of e2e — the stub covers critical flows only.
- Known experience gaps: no two-finger zoom in the PDF reading branch; drawer focus trap / background scroll lock pending; ~1-minute free-tier cold start; material bytes missing after reload require guided manual re-upload.

---

*Source index: `AGENTS.md` · `backend/AGENTS.md` · `docs/architecture/` · `docs/adr/0001-mastery-computation.md` · `docs/deploy.md` · `docs/agents/workflow.md` · `docs/design/northstar-import/IMPORT.md` · `.scratch/phase-{1,2,3}/` · `render.yaml` · `justfile` · `.github/workflows/ci.yml`.*
