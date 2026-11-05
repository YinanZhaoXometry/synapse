# 02: Mistakes hub — `/mistakes` re-point (FR-23)

**What to build:** the retained Mistakes page consumes the read model: all wrong answers (Choice + Open) with Material, section, and the user's answer; grouped/filtered by Study Plan and Study Task; deep links into the reader via the position-anchor channel (`?page=N`/`#section-id`); entries relaunch study (re-quiz the section).

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-09-t02-mistakes`; gates: codegen/tsc/eslint/vitest 579 / build all green)

**Bound by:** FR-23 (grouping, source location, task entries under their task), AD-8 (reader anchor channel — the only cross-feature command), AD-9 (bilingual, keyboard-complete).

- [x] Every wrong answer from factory evidence renders with source + user answer (7 hub-page specs over the Apollo-level stub: Choice-option-text + Open paths, forfeit label, node chips, log dates)
- [x] Plan/task grouping + filtering; empty state honest (no mock fallbacks) — first-occurrence groups over the flat list, per-group collapsible, plan/task filter dropdown; `MISTAKES` fixture + `Mistake` interface retired, demo copy asserted absent
- [x] Deep link lands the reader at the entry's position (real `readerSectionHref`/`readerAnchorHref` hrefs asserted, `hl=1`); re-quiz path produces new evidence (`/plan/:id/quiz?nodeId=` via `nodeQuickTestHref`, task entries → `/task/:id/quiz`)

## Comments

Implementation landed 2026-11-05: op `MistakesHub` in `frontend/src/lib/graphql/hubs.graphql` (the
epic's hub-ops home — T3–T6 add theirs here) → codegen → `useMistakesHubQuery` +
`resolveMistakeAnswer` in `frontend/src/api/queries/hub-queries.ts` (the first hub-hooks file;
views carry the wire's ids verbatim). The page groups the flat newest-first list client-side
(first occurrence = group order), one collapsible section per plan/task with a kind chip
(计划/任务) + count, and a plan/task filter dropdown. Decisions:

- **Titles resolve client-side through list reads** — the hub wire carries ids only (T1's
  shape, backend untouched), so the page adds `useAllMaterialsQuery` + `usePlansQuery` +
  `useTasksQuery` for material titles, plan topics, and task node titles; plan-section node
  chips resolve through each group's own `usePlanNodesQuery` (the light plans list carries no
  node tree). An unresolvable id renders raw — never a guessed title.
- **Choice answers render the resolved option text** (`resolveMistakeAnswer`): the runner
  stores the option string as userAnswer (session-machine), so a matching option IS the
  resolution; anything drifted renders verbatim, never guessed. Forfeits (empty answer) render
  the honest 「看答案放弃」 label instead of an empty box.
- **Task-context re-quiz links carry no `nodeId`** — the quiz-session page ignores it on the
  task route by contract (the task's single material IS its scope); plan entries relaunch
  `nodeQuickTestHref` (the T5-completed `?nodeId=` loop).
- `localeTag` moved to the plans feature's public index (first out-of-feature consumer).
- One-off full-suite flake observed once mid-ticket (unidentified test, not the new specs —
  three consecutive clean 579/579 runs after); nothing pinned to this change.
