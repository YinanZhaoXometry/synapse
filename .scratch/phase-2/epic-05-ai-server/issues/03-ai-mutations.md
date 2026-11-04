# 03: AI mutations — quiz / flashcards / grading / proposal-confirm

**What to build:** `generateQuiz(mode, scope)` (Open/Choice/Mix; strictly materials-sourced — NFR-1; questions node-attributed at generation per AD-6), `generateFlashcards`, `gradeOpenAnswer` (grade + rationale against the material), and the proposal-confirm persistence path consuming a streamed creation-chat proposal payload. Commands wrap the adapter, persist via epic-03's commands, return typed Failures (cap, provider down → INTERNAL, validation).

**Blocked by:** 1, 2.

**Status:** done (2026-11-04)

**Bound by:** AD-16 (all AI ops are mutations except token streams — A2), AD-5 (generation contract), AD-6 (attribution always; targeting is epic-10), AD-12/13 (commands + scoping).

- [x] All four flows green against the stub provider; outputs node-attributed + materials-sourced (asserted) — see the proposal-confirm note below
- [x] Only Open + Choice question shapes ever generated (enum-guard)
- [x] Failures typed via the closed enum; scoping context inherited
- [x] schema.graphql grows by exactly these mutations; codegen green

## Comments

- **Proposal-confirm (delta-grill finding 1):** the persistence path already exists — epic P2-3's `confirmProposal` mutation + `Plans::ConfirmProposalCommand`, whose `stages` shape matches Phase-1's `ProposedStage` verbatim. Ticket 03's remaining deliverable for that flow is the **stream payload contract** (the proposal the terminal event carries), which lands with ticket 04 and is frozen there. No new mutation in this ticket — nothing to build here was built twice.
- Three commands under `app/commands/ai/`, each wrapping the seam and persisting through the epic P2-3 commands (the only write paths): `GenerateQuizCommand` (replay-before-spend — an owned client_uuid returns the existing session WITHOUT a provider call, so a network-timeout retry never spends two cap calls; normalization drops unusable questions and requires ≥1 survivor else INTERNAL; choice shapes must carry camelCase `options`/`correctOptionIndex`), `GenerateFlashcardsCommand` (one card per usable section, server-minted card uuids), `GradeOpenAnswerCommand` (pure computation — outcome/rationale/citation; NO persistence; the client's follow-up `recordEvidence` makes it evidence, the Phase-1 shape).
- The enum-guard is normalization: kinds outside `open|choice`, out-of-scope nodes, unknown materials/sections, and malformed choice shapes are DROPPED (a partially-usable generation beats wasting the spent call); zero survivors → INTERNAL (a provider-contract violation, not a user mistake).
- Schema grew by exactly `generateQuiz`, `generateFlashcards`, `gradeOpenAnswer` (+ `GradedAnswerType`, `CitationType`); `schema.graphql` dumped; web codegen green (the generated `src/types/graphql.ts` is gitignored — the contract artifact is the committed IDL; web consumption is epic-08's).
- The mutation roster guard (`spec/graphql/auth_surface_spec.rb`) was updated with the three new fields — the spec explicitly exists to be kept current with schema growth.
- Gotcha recorded for reviewers: the model-reply JSON keys are camelCase (`correctOptionIndex`) — normalization reads them as such; a snake_case read silently drops every choice question (caught by the wire specs during this ticket's implementation).
