# Spec: Epic 1 (Phase 2) — API foundation: command core, error contract, the full ER

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded entirely in
> the final spine (AD-12/13/10) — no open product questions; the only kickoff delta-review item is gem
> pinning. Gate: epic-00 done.

## Problem Statement

The cutover (epic-08) needs a server that can own the Phase-1 data model, but after epic-00 the api is only a health query. Everything server-side — auth, domain operations, mastery, AI, storage, the cutover itself — would otherwise start from ad-hoc model shapes and an unpinned error vocabulary, the exact drift AD-12/13 exist to prevent. The ER must exist in Postgres before any of it, including the structural Phase-2 fields (FR-38 visibility, FR-16/17 annotations) so later epics don't churn migrations under each other.

## Solution

Land the api's two foundations in one epic:

1. **The command core (AD-12):** `ApplicationCommand` base (dry-initializer + dry-monads `Result`), the never-raise Failure convention, and the **closed error enum** — `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` — with the GraphQL `extensions.code` presenter that will mirror 1:1 into web's `AppError.code` at the cutover. One trivial demo command (a no-op or the future health-adjacent ping) exercises the pattern end-to-end at command level.
2. **The data model (AD-13):** uuid primary keys (client-suppliable on create, server-generated when absent), the users table, and the spine ER — StudyPlan (incl. a `visibility` column, default private — FR-38's structural half), KnowledgeNode, Material (metadata + extracted sections/text columns; file bytes are epic-06's business), StudyTask, QuizSession, Question, EvidenceRecord, Flashcard, MistakeEntry, ChatThread, ReadingProgress, SectionMarking, Annotation — every user-owned row `user_id`-scoped. `strong_migrations` on; plain schema migrations; timestamps throughout.
3. **The testing substrate (AD-10):** factory_bot factories for every entity + the **shared RSpec user-scoping context** that asserts, for every model, that one authenticated user cannot list or fetch another's rows by id (FR-4's testable consequence) — the context every later epic inherits.

No GraphQL surface for the entities belongs here — types and operations are epic-03, so this epic's `schema.graphql` still contains only the health query.

## User Stories

1. As epic-02 (auth), I want a users table + command core, so that credential logic lands on the base class, not beside it.
2. As epic-03 (domain-ops), I want every entity modeled + factories, so that operations are thin wiring over existing tables.
3. As epic-04 (mastery), I want evidence/nodes modeled exactly per the spine ER, so that golden vectors map 1:1 onto rows.
4. As the cutover (epic-08), I want the error enum + presenter pinned now, so that web's `AppError.code` mapping is written once against a frozen vocabulary.
5. As the owner, I want Phase-2 structural fields (visibility, annotations) in the initial migrations, so that later epics don't rewrite history under each other.
6. As a reviewer, I want the scoping context asserting isolation on every model, so that FR-4 is proven by one inherited include, per epic.

## Implementation Decisions

- **Command pattern is binding (AD-12):** commands under `app/commands/`, named `Context::VerbNounCommand`; `ApplicationCommand` owns authorize → call → Result mapping; resolvers stay thin (epic-03 enforces it for real).
- **Error presenter:** one module translating a `Failure(code, context)` into the GraphQL error payload with `extensions.code`; adding a code touches api + web in the same change (the web half lands at cutover).
- **UUIDs:** `gen_random_uuid()` server default **plus** client-suppliable create (idempotency is epic-03/08's contract; the column shape is set here).
- **ER fidelity:** entity names and relations exactly per the spine's ER diagram; fields beyond the spine's "names + ownership" mandate are decided here once and recorded in the spec's diff note at review.
- **Out of scope:** any auth, any GraphQL entity types/queries/mutations, any AI/storage/queue code, any web change.

## Testing Decisions

- RSpec colocated; commands tested directly (AD-10's reference pattern) — the demo command proves authorize/call/Failure wiring.
- Model specs: presence of scoping columns, uuid defaults, the visibility default.
- **The scoping context is the epic's acceptance centerpiece:** it must fail if any model forgets `user_id` scoping.
- Gates: api rubocop + rspec green via `just spec`; `schema.graphql` unchanged (still health-only) — its immobility is itself a check.

## Out of Scope

Auth/JWT (02) · GraphQL entity surface (03) · mastery (04) · AI (05) · blobs/ActiveStorage (06) · Solid Queue (07) · any web/ change.

## Further Notes

- Assumption A1: `visibility` + `annotations` land now (spine: "Phase-2 features add entities at spec time" — this epic *is* that spec time for the structural half; the behavioral halves stay with epics 10/13).
- Assumption A2: `gen_random_uuid()` (pg 13+) over app-side generation — Neon/compose parity holds.
- Kickoff delta-review: confirm gem pins against the spine stack table; nothing else is open.
