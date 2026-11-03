# T3: FR-36 sidebar plan-first ordering — final pass (blocked until epics 5/6 land)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: ../epic-5-tasks/ (whole epic done), ../epic-6-quiz-flashcards/ (whole epic done)

> **Cross-epic edge (directories, not local ticket numbers):** `.scratch/epic-5-tasks/` exists (`f08badd`, `Status: ready-for-agent`, 4 tickets); `.scratch/epic-6-quiz-flashcards/` not created yet (grill round-1 sent 2026-11-03, awaiting owner answers — dir appears when its spec run starts). This ticket is startable only when **both** epic docs read `Status: done` — epic-5 must land its task routes and epic-6 its real in-flow quiz/flashcard surfaces before the sidebar's final ordering can be verified truthfully.

## Parent

[Epic 7](../epic.md) (scale-ladder row 1 — no spec chain).

## Why it's blocked

FR-36's ordering reflects the plan-first IA, and two of its inputs don't exist yet: epic-5 adds the Study Task routes/entry points (e.g. `/task/new` → reader flow), epic-6 turns quiz/flashcards from scaffold stand-ins into real in-flow generation (FR-18/19 — "generation is only reachable from inside a plan/task context on the plan-first surfaces"). Auditing ordering before those land would either verify against stand-ins or force a re-pass.

What already exists (don't rebuild): grouped sidebar nav — 总览 仪表盘 / 学习 AI 导师·学习资料·学习计划 / 练习 测验·闪卡·错题本 / 进度 成就·数据分析 — restored post-epic-2 in `0ecca73` (`nav-items.ts` NAV_GROUPS + `nav.group.*` i18n); profile footer + Settings gear; drawer nav on phone, icon rail on Pad.

## What to build

The final alignment pass over the sidebar once 5/6 are in: ordering front-door-first (学习计划 / plan entry at top of 学习), task entry points placed per FR-36/UX IA, hub entries reflecting real (non-demo) surfaces, and the three FR-36 testable consequences verified end-to-end. Touch only `nav-items.ts` + the nav renderers — AD-9 scaffold conventions; no re-litigating the group structure unless FR-36's consequences force it.

## Acceptance criteria

- [ ] Sidebar ordering is plan-first: front door (学习计划) leads; task entry from epic-5 reachable from the sidebar where the IA calls for it; quiz/flashcard entries reflect real surfaces, not demo stand-ins
- [ ] FR-36 consequence 1: quiz/flashcard *generation* is reachable only inside a plan/task context on plan-first surfaces (verified against epic-6's real implementation — scaffold demo buttons retained for the Nov-6 demo per the PRD retention note)
- [ ] FR-36 consequence 2: all four aggregated surfaces (Mistakes, Today, Flashcards Hub, Quiz Hub — hub stand-ins acceptable per Phase-1 slice) reachable from the sidebar from anywhere
- [ ] FR-36 consequence 3: sidebar footer profile + Settings entry reachable from every page on desktop
- [ ] i18n parity zh + en for any new/changed nav labels; dark mode + all three palettes verified; phone drawer and Pad icon rail still render the new entries correctly
- [ ] Gates green (`node_modules/.bin/tsc -b`, `node_modules/.bin/eslint .`, `node_modules/.bin/vitest run`)

## Comments

- 2026-11-03 — Ticket pre-created with the epic's coupling map at owner request: scope pinned now, work deferred until the blocking edges clear. The `Blocked by:` line is descriptive for cross-epic edges; the frontier scan can't resolve directories — check the two epic docs' `Status:` manually before starting. (Epic-5 state verified post-write: spec chain landed `f08badd` in a parallel session; epic-6 still grill-pending.)
