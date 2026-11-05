# 04: Flashcards + Quiz hubs — `/flashcards` `/quiz` re-point (FR-41/42)

**What to build:** `/flashcards`: every generated deck across plans/tasks, grouped/filterable, flip-card study launchable from the hub (review surface — generation stays in-flow per FR-19/FR-36); `/quiz`: full history with scores + per-question results, **retake** from the hub — a new session seeded from the old scope/mode, producing fresh evidence (NFR-8 no-repeat-inflation).

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-09-t04-deckquiz`; gates: rspec 1064 / rubocop clean / vitest 602 / tsc + eslint + codegen + build green)

**Bound by:** FR-41/42 (aggregation, origins, retake), AD-8 (sessions are sub-routes, never modals), AD-6 (retake evidence attributed at generation).

- [x] Hub lists every deck/session from factory data; filters by plan/task
- [x] Hub-launched study works without entering plan flow; routes are addressable sub-routes
- [x] Retake produces a distinct session + new evidence records (integration spec)

## Comments

Implementation landed 2026-11-05. **Backend (the one schema movement):** `retakeQuizSession(sessionId,
language)` → `Quiz::RetakeSessionCommand` (app/commands/quiz/retake_session_command.rb) — thin mutation,
COMPLETED-only gate (active/abandoned → VALIDATION_FAILED), uniform NOT_FOUND (unknown/foreign/malformed,
the AbandonSessionCommand posture). The retake internally calls `Ai::GenerateQuizCommand` with a
SERVER-MINTED fresh client uuid (SecureRandom.uuid — a uuid the caller never chose, so the delta-3 replay
never engages) + the old session's scope/mode: cap-counting (one provider call), shape guards,
normalization, and the single write path (CreateSessionCommand) stay in ONE place, verbatim. The old
session is untouched (terminal completed is one-way). Deliberately NOT idempotent — each call mints
another attempt; the schema description says so on the wire. Failure passthrough: CAP_REACHED /
INTERNAL / a since-deleted scope's NOT_FOUND all ride the inner generation verbatim.

**Recorded deviation (language):** the ticket said "derive scope + mode + language FROM the old session"
— but quiz_sessions carries NO language column (GenerateQuizCommand's language is a call-time policy,
never persisted), so "derive language" had no source of truth. The mutation takes `language` as a
required argument exactly like generateQuiz does; the hub passes the UI's current language. Scope + mode
derive from the old session as specified.

**Retake wiring (how the new session surfaces):** the hub fires the mutation with the row's sessionId;
on success the payload's NEW session (planId/taskId carried on the wire) drives navigation to its FLOW
route — `/plan/:id/quiz?session=<newId>` or `/task/:id/quiz?session=<newId>` — where the existing
resumption seam (QuizSessionPage's ?session hydrate) mounts the runner. The QUIZ_FRESH_LAUNCH_KEY
sessionStorage marker rides along (the hub started this round in this tab — the 已恢复 reload-note stays
reload-only, T6's honesty thread). A stale `/quiz?session=` link now lands on the hub (the picker
surface retired; the history is the honest landing). NFR-8: evidence attributes to the new session at
answer time — RecordEvidenceCommand already does this; the shape makes replay-of-answers impossible.

**/flashcards (FR-41):** flashcardDecksHub rows (material title, origin chips, card count, the deck
material's createdAt), grouped by plan/task client-side (first occurrence = the server's recency order)
+ the dropdown filter, the MistakesPage posture. Study action deep-links the EXISTING flow routes per
origin kind (plan → /plan/:id/flashcards, task → /task/:id/flashcards) — the hub never generates
(FR-19/36). The attach contract (a material ALWAYS has plan or task) is asserted in the page comment;
if violated in data the row renders in an unattached section WITHOUT a kind chip and WITHOUT a study
action — honest degradation, never an invented route (fixture-tested).

**/quiz (FR-42):** quizHistoryHub rows (origin chip — plan title rides the wire, task title resolves
off the tasks list read; mode chip; date; question count), newest first, dropdown filter. Score summary
`{correct} / {total} 正确` exactly when graded answers exist; zero-graded rows read the honest 未完成
label (evidence lands only at completion, so zero-graded = active or abandoned — the wire carries no
status and the row never claims which; completion ⟺ total > 0 is what the retake gate keys on, and the
server's COMPLETED-only refusal is the truth of last resort). The epic-6 T5 material picker + its
quiz.demo.* copy retired with the re-point (residue-absence asserted in page + i18n tests).

**Demo retirement (T2 posture):** demo-data's FLASHCARDS deck + Flashcard interface and the flash.*
copy (23 keys) are gone; QuizPage's picker machinery and the quiz.demo.*/quiz.eyebrow/title/subtitle
keys are gone; both pages carry no-lies grep audits. quizHub.*/flashcards.hub.* landed zh+en with
parity tests extended to the new namespaces.
