# Epic 8 (Phase 2) — The cutover: Apollo, login wall, import, SSE client, retirement, deploy

Status: ready-for-agent (spec + tickets 2026-11-03; **gate: epics 02+03+04+05+06 all done** — merge point, single integration branch)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) merge point · spine **AD-18** (Apollo 4 + codegen hooks own domain data; simulated AI → dev/test double; auth change resets cache + kills SSE), **AD-15** (login wall; one-time import; client-side logout), **AD-20** (deploy envelope + rehearsed rollback), **AD-16-web** (SSE client: no reconnect, restart, language), **AD-14-web** (client renders server scores) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-apollo-swap.md](issues/01-apollo-swap.md) | — (epic gate) | Apollo Client 4 + typed hooks replace TanStack/repositories; auth-change cache reset |
| 2 | [02-login-wall.md](issues/02-login-wall.md) | 1 | /login /register, token wiring, route guard, demo entry, logout semantics |
| 3 | [03-first-login-import.md](issues/03-first-login-import.md) | 2 | synapse-db:v1 one-shot idempotent import + re-attach invite; local doc never deleted |
| 4 | [04-sse-client.md](issues/04-sse-client.md) | 1 | EventSource wrapper: fresh-ticket restart, cap notice, terminal-code mapping, language param |
| 5 | [05-ai-seam-swap.md](issues/05-ai-seam-swap.md) | 1, 4 | CompanionService server adapter behind the seam; simulated → dev/test double; AppError map; goal-selection (A3) |
| 6 | [06-deploy-rollback.md](issues/06-deploy-rollback.md) | 1–5 | Render + Neon + CORS + seeds + demo-window posture; rollback rehearsal on Pages |

## Definition of done

Login wall up; import round-trips a real Phase-1 `synapse-db:v1` idempotently; streams restart-not-reconnect with cap notice; cross-user cache isolation regression-green; every AI-adjacent web test still passes offline on the double; server-computed scores render (client never recomputes); rollback rehearsed and documented; `just spec` + CI green; two-axis review clean; every ticket cites AD ids.

## Kickoff delta-review log (2026-11-04, T1 in flight)

- **Import mutation home** (spec check): epic-03's set has no ImportDocument mutation — confirmed MISSING, lands in this epic per the spec (T3's job). No delta needed.
- **AD-14 flip is bigger than transport**: plan/task/quiz display shaping computed mastery client-side (planCardMetrics, nodeRowViews, taskMasteryView, quizNodeRows all called computeNodeScore/computePlanRollup/getNodeState). T1 reworks them to render the api's masteryScore/state fields; the ADR-0001 arithmetic leaves the web runtime (the TS domain stays as the golden-vector SOURCE for the anti-drift gate only).
- **Contract gap #1 (surfaced, not absorbed)**: the api exposes no per-session score surface → the quiz results' before→after delta and the plan-home recent-activity score render WITHOUT those numbers (server current score + counts only). Candidate fix rides epic-09's Analytics re-point or an api addition; do not re-derive client-side.
- **Contract gap #2 (surfaced)**: deletePlan's cascade removes materials; the client sweeps materials/progress lists on delete. Flashcard/session cleanup on cascade is server-side territory — verify behavior in the smoke pass.
- **Entry gate reshaped (transitional)**: `/` now always lands on Plans Home (the creation chat is the front door for a first-run); the onboarding wizard stays reachable at /onboarding with no flag write. Ticket 02 (login wall) + ticket 03 (import invite) own the final entry states.
- **Settings reset semantics**: client reset = clear UI prefs + sign out (token + cache wipe). It never deletes study data (server-side account surfaces = epic-14). i18n copy updated.
- **Materials lists carry full sections** (not summaries): the continue-reading line resolves locators against sections and quiz generation sources them — one document serves both; plan.materials stays a summary on the plan detail.
- **Codegen output committed**: src/types/graphql.ts flipped from gitignored to committed (runtime-load-bearing documents) with a regenerate+diff freshness gate in just spec + ci.yml.
- **Test harness**: src/test/apollo-harness.tsx — a stub-GraphQL echo server (per-operation handlers deriving payloads from variables) for the driver/evidence-loop walks; static MockedProvider mocks for surface tests.

## T3/T4 delta-log additions (2026-11-04)

- **T3 built the api's importDocument** (delta-review had confirmed it missing): whole-document, idempotent (same-user replay merges; any foreign uuid → VALIDATION_FAILED pre-write, atomic), byteless materials, evidence createdAt verbatim, 13 Imported*Input types mirroring the live doc. Frontend: one-time offer (marker on NEW key `synapse-import:done` — "not now" spends it) + re-attach invite via refreshBytes; legacy doc never deleted.
- **Guard-vs-codegen**: schema descriptions must not carry the literal `synapse-db:v1` — codegen copies descriptions into the committed types and the guard forbids the literal there (rephrased as "the Phase-1 local document").
- **T4 wrapper**: drop → close-then-fresh-ticket restart (cap counts REDEEMS, Ai::DailyCap 50/user/UTC-day, server env-owned — the client never hardcodes the number); client-side drop-loop guard (maxRestarts=3 → INTERNAL) added beyond ticket wording; terminators register per-SESSION (no stacking), resetApiClient cancels whole sessions. Apollo 4 mutate rejects with CombinedGraphQLErrors (singular `error` on MutateResult).
- **Worktree env note**: a fresh test DB's db:prepare auto-seeds the demo account and breaks the 3 global-count confirm_proposal specs — use `db:drop db:create db:migrate` (the CI form) in agent worktrees.

## T5 delta-log additions (2026-11-04)

- **Additive seam inputs beyond the enumerated set:** `chat` + materialId (the server companion ticket is material-scoped and refuses to mint without it); generation language rides a provider-owned mirror (`currentUiLanguage()`), read at call time.
- **SURFACED: quiz double-session on the server path** — GenerateQuiz persists a session (adapter's clientUuid); the driver's createQuizSession makes a second → one orphaned ACTIVE session per server-path quiz start. Fix options recorded on ticket 05 (thread the driver's uuid through the seam, or a generate-only server op). Epic-owner decision pending; do not absorb silently.
- **Seam-factory design:** runtime default = ServerCompanionService; vitest setup calls forceSimulatedCompanion() once (the flag lives in a dependency-free leaf, src/ai/seam-preference.ts — importing the flag from companion-service.ts in setup.ts eager-loads the AI→Apollo graph before test vi.mock factories register).

## Coordination notes

- **Single integration branch** — no parallel lanes inside; T4 ∥ T5 mid-branch at most. Owner-side provisioning (Render/Neon/R2 ENV) must be in hand before T6 (roadmap owner table).
- Epic-07 is deliberately **not** a gate; if its T1 (Solid Queue runtime) has landed, T6 boots it in-process; otherwise T6 configures without it and 07 lands later (flagged in both epics).
- The SSE ticket contract (epic-05 T4) and the error enum (epic-01 T1) are consumed **verbatim** — any drift is a cross-epic edit, surfaced not absorbed.
- `UserProgressContext` stays frozen read-only here (A1); epic-09 retires it page by page.
