# Spec — epic-31 adaptive-review

Milestone: Phase 4 — learning-engine season
Status: ready-for-agent

## Problem Statement

复习节奏是死的。一个学生反复答对同一道错题，第四天之后永远等 7 天才再见它；一张自评「简单」的闪卡永远 10 天一循环，哪怕连续三个月都记得。反方向同样僵：分数好也不能把间隔拉得更长，同一天里连刷四次测验就能把错题阶梯登顶——复习系统奖励的是刷题量，不是真实的记忆表现。导出侧，学生想把这些卡片放进 Anki 自己的循环，Synapse 没有出口。

## Solution

把 requeue 的固定阶梯升级为**几何增长**：错题连续答对，间隔按 [1, 2, 4, 8, 16] 天翻倍；闪卡按自评难度各有自己的几何阶梯（hard [2,4,7] / medium [5,10,14] / easy [10,20,30] 天），连续评「简单」逐级拉长，评「难」打回起点。同一天内的重复作答/自评不推进阶梯——防磨分，不防学习。今日列表里错题排在同日到期的闪卡前面；已「解决」的错题继续被复习（复习是防遗忘，不是一次性修理），但复习再错会重新打开它。最后，每个资料的卡组可以一键导出成 Anki 可导入的文件，再次导出更新既有卡片而不是制造重复。

## User Stories

1. As a student, I want my mistake-review intervals to double each time I answer it correctly, so that time is spent on what I actually forget instead of what I demonstrably know.
2. As a student, I want a mistaken question I keep getting right to eventually reach a long interval (16 days), so that mastered material recedes gracefully instead of capping at one week.
3. As a student, I want answering a mistake wrong again to reset its interval to tomorrow, so that the schedule reflects my real recall, not my streak history.
4. As a student, I want same-day repeated quiz attempts on the same mistake NOT to advance its ladder, so that grinding one session cannot fake long-term retention.
5. As a student, I want my flashcard's interval to grow when I rate it easy repeatedly, so that cards I clearly know stop consuming review time.
6. As a student, I want rating a card hard to send it back to the shortest interval, so that struggling with a card keeps it in front of me.
7. As a student, I want rating a card medium to hold its current rung, so that ambivalence neither punishes nor rewards the schedule.
8. As a student, I want same-day repeat self-ratings of the same card NOT to advance its stage, so that tapping "easy" twenty times cannot cheat the schedule.
9. As a student, I want an unrated card to be due immediately, so that new decks are studyable the moment they exist. (Existing behavior, pinned.)
10. As a student, I want mistakes to appear before flashcards when both are due today, so that my known weak spots get the freshest attention.
11. As a student, I want a mistake I resolved to keep appearing on its schedule, so that resolution means "currently recalled", not "never seen again".
12. As a student, I want a resolved mistake that I answer wrong again in review to re-open in the mistakes hub, so that the hub reflects my live failure set, not a museum.
13. As a student, I want to export a material's flashcard deck as an Anki-importable file, so that I can study in the SRS I already trust.
14. As a student, I want re-exporting the same deck to update my existing Anki cards instead of duplicating them, so that my Anki library stays clean as Synapse cards improve.
15. As a student, I want math and formatting in a card's front/back to survive the export, so that exported cards read like the in-app ones.
16. As a student reviewing on the Today hub, I want the due list ordered the same way every time (due date, then mistakes first), so that the list is predictable and resumable.
17. As the owner demoing the app, I want the review rhythm to visibly respond to performance in a single session, so that the "adaptive" story is demonstrable without weeks of usage data.

## Implementation Decisions

**D1 — Geometric mistake ladder.** The mistake interval ladder becomes `[1, 2, 4, 8, 16]` days (from `[1, 2, 4, 7]`). Stage semantics unchanged: consecutive `correct` evidence records after the mistake (`wrong`/`partial` reset to 0), anchored to the newer of the mistake's creation and its latest post-mistake evidence, capped at the final rung (due date keeps sliding, spacing stays). This is the AD-19 pure-function posture with new constants — no scheduling state, no new tables.

**D2 — Flashcard stage column + per-difficulty geometric ladders.** `flashcards` gains a persisted `stage` integer (NOT NULL, DEFAULT 0, CHECK ≥ 0) — the ONLY new persisted state in this epic. `rateFlashcard` maintains it: `easy` → +1 (capped at the ladder's end), `hard` → 0, `medium` → unchanged. The scan reads a two-dimensional table on the Requeue module: hard `[2, 4, 7]`, medium `[5, 10, 14]`, easy `[10, 20, 30]` days, indexed by `min(stage, len−1)`; unrated cards (difficulty nil) remain due immediately. The flashcard's `stage` field on the DueItem wire type starts carrying the real value (its description says "flashcards stay 0" — that text is updated).

**D3 — Same-day guard (anti-grind).** Mistakes: stage derivation only counts a `correct` run whose consecutive events fall on different UTC calendar days — two `correct` evidences on the same UTC day advance the stage once. Flashcards: `easy` advances the stage only if the card's previous `updated_at` (the prior rating moment, read before the overwrite) is not today UTC; `hard` resets regardless. UTC matches the Today hub's day semantics and the ADR-0001 UTC posture.

**D4 — Due ordering: mistakes first.** The due list keeps `next_due_at ASC` as primary order; ties break mistakes before flashcards, then by id. No risk model, no new ordering columns — the discrete form of DeepTutor's active-error bonus (comparison §3.7) without a second scheduler's machinery.

**D5 — Resolved interplay.** The scan continues to ignore `resolved` (a resolved mistake stays scheduled — review is anti-forgetting). When grading records `wrong` or `partial` evidence for a question whose MistakeEntry is `resolved`, the entry flips back to `resolved = false` in the same fold (the hub resurfaces it; the requeue schedule's stage has already reset via the evidence timeline). `forfeited` needs no separate path — a forfeit is graded wrong, so its evidence re-opens the entry identically.

**D6 — Anki export.** A new GraphQL query takes a material id and returns the export file's text content (the closed error enum's NOT_FOUND covers an unknown material; an empty deck is an empty export, not an error). Format: Anki 2.1.55+ text import headers (`#separator:tab`, `#html:true`, `#notetype:Basic`, `#deck column:3`, `#tags column:4`, `#guid column:5`), one row per card: front / back / deck / tags / guid. Deck name `Synapse::<material title>`; tags `synapse` plus a kebab-case slug of the material title; GUID = stable content hash of the card's fields — re-export after editing updates the same Anki note instead of duplicating. Card fields get a minimal Markdown→HTML pass (bold, italic, inline code, newlines→`<br>`) with tabs/newlines stripped from the tab-separated fields; no MathJax translation (in-app card math support is not there to preserve).

**D7 — Web consumption.** The flashcards hub's material-deck view gains an export action: invokes the query, downloads the response as a `.txt` Blob named after the material. New i18n keys (zh/en parity is enforced by the full-table test). No new routes, no R2 involvement — the export is a string over the wire.

**D8 — Alignment.** AD-19 (correct-on-wake: the derivation rules change, the recompute-and-prune shape does not), AD-12 (plain UUID strings on the wire), the backend command-layer-first rule (ladder constants and stage math live in the Requeue module/command, not resolvers), ADR-0001 untouched (ratings stay non-evidence; no amendment owed by this epic). Schema movement is additive (one column) — strong-migrations safe.

## Testing Decisions

- **The scan command is the behavioral seam.** Its specs build source rows (mistakes + evidence timelines, flashcards + ratings), run the scan, and assert the materialized schedule rows (stage, next_due_at). The pure-function posture makes this table-driven; prior art: the epic P2-7 scan/job specs and the GraphQL integration walk.
- **Ladder tables get parametrized specs** — every (difficulty, stage) rung pinned, including each cap rung and the unrated/immediate case, so future tuning is a visible diff.
- **Same-day guard tests** construct same-UTC-day and cross-day evidence pairs (mistakes) and same-day double ratings (flashcards), asserting exactly one stage advance or none.
- **rateFlashcard request specs** assert the stage transitions (easy/hard/medium, same-day idempotence) alongside the existing rating assertions.
- **Resolved re-open** is asserted in the evidence-recording request specs: wrong/partial flips a resolved mistake back; correct does not.
- **Export**: a request spec pins the exact TSV bytes (headers, deck naming, tag slug, GUID stability across content-identical re-exports, GUID change on content edit, Markdown→HTML of each supported construct, field sanitization), plus the unknown-material error. The frontend deck view gets a component test (userEvent-first) asserting the download invocation; i18n parity is enforced repo-wide by the full-table test.
- Frontend tests use the established vitest component seam; no new e2e spec (the export is one button; component coverage plus the request spec is the right altitude).

## Out of Scope

- Any retrieval/forgetting-curve model, `desired_retention`, review-strategy presets, or a second scheduler (parked, phase-4 board).
- ADR-0001 amendments (owned by epics 29/30), independence flags, defer/void (29/32's scope).
- Anki export of mistakes or quiz questions (cards only), `.apkg` format (plain TSV import is sufficient), scheduled/automatic exports.
- Roadmap/Today UI changes beyond the due-list ordering the scan already feeds.
- Editing card content from the deck view (existing flows unchanged).

## Further Notes

- The DeepTutor mechanics this adapts: comparison doc §3.6 (independence excluded — that's 29), §3.7 (decay lives in review state, never the mastery score — we go further and keep decay discrete), §3.9's Anki GUID trick (update-not-duplicate via stable content hash).
- The flashcard `stage` column is written by `rateFlashcard` only; the scan never writes source rows (AD-19's cache posture) — if a future migration needs to backfill stages, it derives them from `updated_at` history, which doesn't exist, so fresh cards start at 0 (acceptable: pre-upgrade cards re-earn their rungs at the next rating).
- The DueItemType description text and the GraphQL schema description for flashcard stage are user-visible contract text — updated in the same change that makes flashcards carry stages (codegen refresh + fixture sweep per the epic-11 lesson).
