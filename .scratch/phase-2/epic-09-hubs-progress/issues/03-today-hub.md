# 03: Today hub — `/planner` becomes 今日学习 (FR-27)

**What to build:** the Planner page re-points to the daily list: due Re-queue reviews (epic-07 `dueItems`) + user-added manual tasks (+ AI-suggestion slot — v1 may ship dues+manual, suggestions flagged partial per delta-grill); each item with duration estimate, priority, completion toggle; day-progress summary + light week strip (calendar browsing stays demoted); zh label **今日学习** (学习计划 reserved for Study Plan).

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-09-t03-today`; gates: rubocop clean / rspec 1051 / codegen-tsc-eslint-vitest 597-build all green)

**Bound by:** FR-27 (item shapes, label rule, trace-to-gap for suggestions), AD-9 (bilingual floor), AD-13 (manual tasks persist user-scoped — needs a small api op; add in this ticket).

- [x] Due items appear on their due date, completable, deep-linked into study flow (completion IS the flow's fresh evidence — no inline review toggle; per-kind link matrix below)
- [x] Manual task add/complete/toggle persists (new op passes scoping context) — `addManualTask` / `setManualTaskDone` / `deleteManualTask` behind `current_user!`, NOT_FOUND matrix, idempotent toggle
- [x] Label rule verified zh+en; suggestions (if v1) trace to their mastery gap (the card names the plan + its weakest node by server score)

## Comments

Implementation landed 2026-11-05 (one commit on `epic/p2-09-t03-today`). Backend (the ops T1
deferred): `Progress::AddManualTaskCommand` / `SetManualTaskDoneCommand` / `DeleteManualTaskCommand`
(`app/commands/progress/` — the Progress context per T1's setter precedent) behind thin
`Mutations::Hubs::{AddManualTask,SetManualTaskDone,DeleteManualTask}`; title bounded ≤200 chars
(strip first — blank and >200 are VALIDATION_FAILED); `dueDate` rides the DateTime scalar and the
command normalizes to the plain DATE it names (a date-only wire string coerces; the day is the
fact, `ManualTaskType` reads it back at midnight); done-toggle idempotent (same state → the row
returns, `updated_at` untouched — pinned at DB precision and on the wire); unknown/foreign/
malformed ids uniformly NOT_FOUND (the house matrix); auth surface roster grew the three ops;
`schema.graphql` re-dumped (+135 lines, no type changes beyond the three payloads). Specs: 18
command examples + 9 wire examples (auth guard, validation, NOT_FOUND matrix, idempotency,
todayHub read-backs).

**FR-27 item shapes — duration estimate + priority are a PARTIAL delivery, recorded honestly.**
ManualTask's table (T1) carries title/due_date/done only; there is NO server field for duration or
priority, and adding columns is a schema change the orchestrator has not pinned — so the page
renders items WITHOUT duration/priority and no columns were added (confirmed). The old demo chips
(minutes, 高/中/低, AI-suggested) retired with the page. When the epic pins the shape, the columns
land with a migration ticket and the page grows the chips.

**Due-item link targets (picked per schedulable kind, honest-first — each target launches the flow
that completes the item; there is no "mark review done" op and inventing one would be unpinned
schema, so "completable" = the flow's fresh evidence):**
- **mistake, task context** → `/task/:id/quiz` (the task's quiz route; its single material IS its
  scope, no nodeId — T2's exact rule)
- **mistake, plan context** → `nodeQuickTestHref` (`/plan/:id/quiz?nodeId=` — the node-scoped
  quick-test loop produces the re-answer evidence that advances the ladder)
- **mistake, no context** → `/mistakes` (the unlinked entry's home — the anchor fallback)
- **flashcard, task context** → `/task/:id/flashcards`; **plan context** → `/plan/:id/flashcards`
  (the deck flows — the rating IS the rescheduling act); **no context** → `/flashcards` (hub
  fallback). The full matrix is pinned twice: through the rendered DOM and as a pure-seam spec
  (`dueItemHref`, which throws on an unknown kind).

**Week strip:** the read model has no per-day evidence calendar, so the strip consumes
`analyticsSeries.consistency` (the last 14 UTC days including today, zeros included — SM-C3
session counts) mapped onto the current Mon–Sun UTC week; today is highlighted; the week's FUTURE
days (the only current-week days the 14-day window cannot cover — Monday sits at most 6 days back)
render as no-data (dashed), never as quiet-with-zero. Mapping lives in
`frontend/src/domain/today-week.ts` (`todayWeekStrip` + `utcDayKey`, the ADR-0001 day-key
convention) with AD-10 domain coverage. No new backend field was built for this (as directed).

**Label rule:** `planner.eyebrow` + `nav.planner` are zh **今日学习** / en **Today**; `nav.plans`
stays 学习计划 / Study Plans. The hub returned to the sidebar (nav-items' own recorded intent —
"returns to the nav when FR-27 lands"), slotted into the 练习 group 错题本 → 今日学习 → 闪卡 →
测验 per FR-36's listing; `nav-items.test.ts` updated. Pinned by both dictionary assertions and
page-level render assertions (zh default; the page never renders 学习计划).

**Day-progress summary:** `todayHub.summary` counts render as chips (到期复习 / 待办任务 /
已完成); `doneCount` is labeled as the plain done count — it is ALL-TIME (ManualTask has no
done-at timestamp, T1's recorded honest limitation), so no day-scoped percent is invented and the
demo progress bar retired with the page.

**Demo retirement:** `PlannerTask` + `DEFAULT_TASKS` left `demo-data.ts`; the `planner.task1..5`
/ `task*Meta` / `high`/`medium`/`low` / `ai` / `daySub` / `streakNote` / `done` keys left the
dictionary (zh+en); the page consumes `useUserProgress` no more (streak rides the server
`useStreakQuery`). Residue absence asserted in the page specs.

**Ops wiring note (bugs caught by the tests):** the first cut passed `{ input }` directly to
`mutate()` — Apollo silently sent EMPTY variables; the house convention is
`mutate({ variables: { input } })` (TaskCreatePage et al.), and the stub tests caught it because
the read-back sweep rendered nothing. The read-back sweep (`refetchQueries: [TodayHubDocument]` on
all three op hooks) is verified in specs by mutating the captured fixture arrays inside the
mutation handlers, so the DOM update can ONLY come from the refetch.

**One-off full-suite flake:** the first full vitest run after landing showed a single failure
(596/597, test name not captured before re-run); two consecutive clean 597/597 runs followed, plus
5/5 clean runs of the new spec files. Same shape as T2's recorded one-off; nothing pinned to this
change.
- **Two-axis review (2026-11-05, inline):** PASS/PASS — label rule verified in dictionary + page; due-link matrix honest per schedulable kind (deep-linked flow IS the completion, no invented mark-done op); idempotent done-toggle (no write on same state, updated_at untouched, DB-precision + wire pinned); duration/priority NOT added (deferral recorded, partial delivery honest); week strip rides consistency (no new backend field); 13th eslint warning = the house page-file-export precedent. Merged on `epic/p2-09-hubs`.
