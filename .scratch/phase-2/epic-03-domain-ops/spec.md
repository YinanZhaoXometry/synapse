# Spec: Epic 3 (Phase 2) — Domain operations: the GraphQL surface for the Phase-1 data model

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> AD-12/13 + the Phase-1 repository surface (the operations mirror what `src/data` repositories expose
> today). Open items (input-shape details, the node-attribution argument on quiz ops) resolved at this
> epic's kickoff delta review against the actual Phase-1 repository code. Gate: epics 01+02 done.

## Problem Statement

At the cutover, Apollo replaces the repository seam (AD-18) — but the server has nowhere to send the client: no queries or mutations exist for plans, tasks, materials, evidence, quiz sessions, flashcards, chat, progress, or markings. Every repository method the web app calls today needs a server counterpart, or the cutover epic invents them one by one under deadline pressure.

## Solution

Build the complete GraphQL surface for the Phase-1 data model as thin resolvers/mutations over commands, sliced by aggregate:

1. **Plans + nodes:** plan CRUD + confirm-proposal persistence (staged nodes from the creation chat — proposal payload arrives from epic-05's stream, confirm lands here), node listing/state reads, task-section reads on Plan Home.
2. **Tasks + materials:** Study Task create/read; material attach (metadata + extracted sections/text + parse state — client-supplied, parsing stays client-side per AD-7), material listing/detail.
3. **Evidence + quiz + flashcards:** quiz session create/persist (questions with node attribution at generation time — AD-6), attempt/grade recording → EvidenceRecord writes, flashcard deck + study-state writes.
4. **Chat + progress + markings:** ChatThread persistence (messages, citations), ReadingProgress writes (locator + extracted text — the domain `ReadingPosition` verbatim), SectionMarking claim/unmark.
5. **Integration walk:** cross-aggregate spec coverage (the FR-1→FR-20 happy path executed as GraphQL ops), `schema.graphql` growth reviewed, codegen proof in web.

Every mutation accepts **client-supplied uuid** (idempotent create per AD-12); every command receives `current_user` and inherits the scoping context (FR-4); pagination stays plain lists (Relay deferred until evidence history actually paginates).

## User Stories

1. As the cutover (epic-08), I want every Phase-1 repository method mirrored server-side, so that Apollo hooks replace seams 1:1 with no invented contract.
2. As a user, my plans/tasks/materials/progress are readable and writable across devices (FR-31's server half).
3. As epic-05 (AI), I have persistence commands to write generated quiz/flashcard/chat artifacts into.
4. As epic-04 (mastery), score fields have host types to hang off (coordination note).
5. As an attacker, I cannot address another user's rows by id — proven by the inherited scoping context on every operation.

## Implementation Decisions

- **Thin by construction (AD-12):** resolver ≤ parse/authorize/call/map; a resolver with logic is a review blocker.
- Slice order 1→4 matches data-flow dependency (materials before evidence; chat before progress is arbitrary but keeps ticket diffs disjoint).
- Input shapes mirror the Phase-1 domain entities (`docs` field names camelCase per convention) — exact deltas resolved at kickoff against `src/data` interfaces; deviation list recorded in ticket Comments.
- Node attribution: quiz-session inputs carry question→nodeId mappings (AD-6: attribution at generation time, always).
- **Out of scope:** AI generation itself (05), blobs/presign (06), mastery computation (04), SSE (05), any web change (08).

## Testing Decisions

- Every operation: happy path + scoping-context cross-user assertion + typed Failure mapping, tested via direct GraphQL execution (AD-10 reference pattern) with factory graphs from epic-01.
- Idempotency: replayed create with same client uuid is a no-op success.
- Gates: rubocop + rspec; `schema.graphql` re-dump idempotent; `pnpm codegen` in web emits types for the new schema.

## Out of Scope

Auth mutations (02) · AI/SSE (05) · storage/presign (06) · mastery fields' values (04 — this epic may expose `masteryScore` as a placeholder null or omit; decide at kickoff) · Square/public reads (11) · hub aggregation queries (09).

## Further Notes

- Assumption A1: one epic despite size — the slices share factories + presenter wiring; splitting would duplicate setup. If ticket 3 (evidence) slips, 05 can stub persistence temporarily — flagged, not planned.
- Kickoff delta review: diff the operation list against `src/data` repository interfaces before writing (the real source of truth for shapes).
