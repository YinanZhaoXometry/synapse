# Epic 3 (Phase 2) — Domain operations: the GraphQL surface for the Phase-1 data model

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epics 01+02 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane A (critical path) · spine **AD-12** (thin GraphQL over commands), **AD-13** (user scoping on every op), **AD-3's retirement target** (this surface mirrors the `src/data` repositories the cutover replaces), AD-6 (node attribution) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-plans-nodes.md](issues/01-plans-nodes.md) | — | plan CRUD, proposal confirm persistence, node reads |
| 2 | [02-tasks-materials.md](issues/02-tasks-materials.md) | 1 | Study Task ops; material attach (metadata + sections/parse state) |
| 3 | [03-evidence-quiz-flashcards.md](issues/03-evidence-quiz-flashcards.md) | 2 | quiz session persist (node-attributed), attempt/grade → EvidenceRecord, flashcard ops |
| 4 | [04-chat-progress-markings.md](issues/04-chat-progress-markings.md) | 1 | ChatThread persistence, ReadingProgress writes, SectionMarking claim/unmark |
| 5 | [05-integration-walk.md](issues/05-integration-walk.md) | 3, 4 | cross-aggregate GraphQL walk (FR-1→FR-20 path), schema review, codegen proof |

## Definition of done

The Phase-1 happy path executes as pure GraphQL ops against factories · every op proven user-scoped · client-uuid idempotent create · `schema.graphql` idempotent + web codegen green · rubocop+rspec green · resolvers thin (a logic-bearing resolver = review blocker) · every ticket cites AD ids.

## Coordination notes

- **Gate: epics 01+02 done** (command-level overlap with late-02 allowed per roadmap — coordinate migration races).
- **Epic-04 coordination:** mastery score fields hang off this epic's KnowledgeNode/StudyPlan types — epic-04's ticket 3 implements the resolver bodies; this epic decides field placement (or omits + 04 adds; kickoff decides, recorded in ticket 1 Comments).
- **Epic-05 dependency:** 05's mutations persist through this epic's commands (quiz/flashcard/chat); 05 opens when this epic closes.
- Slice order 1→5 is dependency order, not preference; 1 ∥ 4 can overlap in one lane if needed.

## Kickoff delta review (2026-11-04, standing decide-all delegation — "全部按推荐")

1. **Mastery fields (ticket 1 AC):** OMIT `masteryScore` from this epic's types — epic-04's ticket 3 adds the fields + resolver bodies to KnowledgeNode/StudyPlan types. No placeholder nulls in the contract.
2. **Cross-user addressing (scoping):** any cross-user by-id fetch/mutation → `NOT_FOUND` (uniform; never reveals existence — FR-4's testable consequence). `FORBIDDEN` stays reserved (unused this epic). Enforced at the command layer via the user-scoped association path (`user.x.find_by(id:)` / `.find`), asserted per-op by the inherited scoping context.
3. **Idempotent creates (AD-12):** same-user replay with the same client uuid → Success returning the existing row (no-op); same id owned by a DIFFERENT user → `VALIDATION_FAILED` (ownership verification — never silently link, FR-4).
4. **Commands & transactions:** one command = one transaction; naming `Context::VerbNounCommand` under `app/commands/<context>/` (Plans:: / Tasks:: / Materials:: / Quiz:: / Flashcards:: / Chat:: / Progress:: / Markings::). Mutations/resolvers stay ≤ parse → authorize (`current_user!`) → call → map.
5. **Operation shapes mirror the Phase-1 repositories** (`frontend/src/data/*-repository.ts` + `*-queries.ts` — the real source of truth): each ticket diffs its slice against the repo interface and records the deviation list in its Comments. Flashcard study-state = the `difficulty` self-rating write on the Flashcard row (Phase 1 never creates EvidenceRecords from flashcards — entities.ts); MistakeEntry only from quiz wrong answers.
6. **Oversized-section guard:** per-section extracted text capped at 100,000 characters → `VALIDATION_FAILED` beyond (quota-era rule carried server-side; AD-4's bounded-section posture).
7. **ReadingPosition verbatim (AD-2):** ReadingProgress/annotations-style payloads carry `locator` ({kind:"pdf",page} | {kind:"markdown",sectionId}) + `text` as jsonb with TS keys exactly (camelCase), round-trip asserted.
8. **Auth:** every op except `health`/`register`/`login` demands auth via the epic-02 guard → UNAUTHORIZED when absent/invalid/expired.
9. **Schema moves ride codegen proofs:** every ticket that grows `schema.graphql` also runs `pnpm codegen` + `frontend/node_modules/.bin/tsc -b` (generated file stays gitignored); ticket 5 re-proves and diffs the whole growth against the ticket set.
