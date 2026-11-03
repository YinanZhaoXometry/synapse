# 03: AI mutations — quiz / flashcards / grading / proposal-confirm

**What to build:** `generateQuiz(mode, scope)` (Open/Choice/Mix; strictly materials-sourced — NFR-1; questions node-attributed at generation per AD-6), `generateFlashcards`, `gradeOpenAnswer` (grade + rationale against the material), and the proposal-confirm persistence path consuming a streamed creation-chat proposal payload. Commands wrap the adapter, persist via epic-03's commands, return typed Failures (cap, provider down → INTERNAL, validation).

**Blocked by:** 1, 2.

**Status:** ready-for-agent

**Bound by:** AD-16 (all AI ops are mutations except token streams — A2), AD-5 (generation contract), AD-6 (attribution always; targeting is epic-10), AD-12/13 (commands + scoping).

- [ ] All four flows green against the stub provider; outputs node-attributed + materials-sourced (asserted)
- [ ] Only Open + Choice question shapes ever generated (enum-guard)
- [ ] Failures typed via the closed enum; scoping context inherited
- [ ] schema.graphql grows by exactly these mutations; codegen green
