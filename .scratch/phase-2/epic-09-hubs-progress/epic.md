# Epic 9 (Phase 2) — Hubs + progress surfaces: real data behind the retained pages

Status: done (2026-11-05 — all six tickets done + two-axis reviewed; rspec 1064 / vitest 647; UserProgressContext deleted with the architecture grep guard; badge thresholds + Today suggestion heuristic recorded in T1)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-23/26/27/28/41/42 + FR-25 Phase-2 halves ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · UX spines ([EXPERIENCE.md](../../../docs/design/ux-synapse/EXPERIENCE.md)) · AD-9 (bilingual/accessibility floor), AD-14 (rollups server-side), AD-8 (routes) · [spec.md](spec.md). Completes the `UserProgressContext` retirement (epic-08 A1).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-hub-read-model.md](issues/01-hub-read-model.md) | — (epic gate) | api aggregation queries: mistakes/today/histories/analytics/goal/badges |
| 2 | [02-mistakes-hub.md](issues/02-mistakes-hub.md) | 1 | `/mistakes` re-point (FR-23) |
| 3 | [03-today-hub.md](issues/03-today-hub.md) | 1 | 今日学习 daily list, dues + manual v1 (FR-27) |
| 4 | [04-flashcards-quiz-hubs.md](issues/04-flashcards-quiz-hubs.md) | 1 | `/flashcards` + `/quiz` hubs, retake = fresh evidence (FR-41/42) |
| 5 | [05-analytics-dashboard.md](issues/05-analytics-dashboard.md) | 1 | `/analytics` + `/dashboard` re-point + weekly goal (FR-26/25) |
| 6 | [06-achievements.md](issues/06-achievements.md) | 1 | real badge unlocks, 12-badge taxonomy (FR-28) |

## Definition of done

All four sidebar hubs + three progress pages render real, user-scoped evidence · retakes produce fresh evidence · 今日学习 label rule holds · every surface bilingual + theme-complete · `UserProgressContext` deleted with grep-guard · web+api gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epics 07+08 done** (07 only for T3's due items — if 07 slipped, T3 ships dues-less and re-gates).
- T2–T6 parallelize after T1 (two-builder practical max; T3 and T5 are the chunkiest).
- Badge thresholds + Today suggestions heuristic are the delta-grill items — resolve before T1 freezes the read model.

## Kickoff delta review — 2026-11-05 (decide-all delegation, "全部按推荐")

Grounded in code recon @ `ea36eb0`: 9 pages still consume `useUserProgress` (AppLayout + 8 pages); `dueItems` + `streak` + Mastery all server-live; scaffold 12-badge taxonomy = b1..b12 with zh/en description strings in i18n-dictionary; MistakeEntry has no resolved/reviewed flag (epic-10's recorded delta amendment).

1. **Badge thresholds — restated server-computable (T1 pins; T6 renders; reasons recorded):**
   b1 first quiz = ≥1 quiz session · b2 streak 3 = `Mastery.compute_streak ≥ 3` · b3 streak 7 = ≥ 7 · b4 flashcards = ≥10 flashcards exist across the user's decks (collection badge — NO review-event tracking exists server-side; adding review counting is out of scope, recorded honestly) · b5 = ≥100 evidence records · b6 mistakes revisit = ≥5 evidence records whose node has ≥1 mistake entry (复盘 = re-answered on a mistake node — no reviewed flag exists) · b7/b8/b9 = tiered node-mastery: 1 / 3 / 5 distinct nodes with `state = "mastered"` (the scaffold's subject-specific 软件设计/需求/测试 topics don't exist server-side; the 3-tier shape survives, generalized) · b10 daily grind = ≥3 evidence-producing sessions in one UTC day (SM-C3: sessions, never minutes) · b11 = every node of some plan (≥1 node) reads `state = "mastered"` · b12 = any node `masteryScore = "100"`. All computed on read, server-side (spec posture).
2. **Today suggestion heuristic v1 (partial, honest):** the slot renders per-weak-plan quick-test suggestions derived from SERVER state fields only — for each plan with ≥1 node in `state != "mastered"` and ≥1 mapped section, one suggestion card (plan title + weakest node title + 节点快测 deep link `/plan/:id/quiz?nodeId=`). Client picks+links (rendering decision); the server score stays the only truth; the slot carries the partial flag (partial v1). No new AI surface (AD-16); epic-10-T5's documented consumer shape stays available for a later real generation-backed slot.
3. **Weekly goal home = `users.weekly_goal_target`** INT NOT NULL DEFAULT 3 CHECK 1..21 (sessions/ISO week, SM-C3); `setWeeklyGoal(target:)` mutation lands in T1's read model; Settings' simple half gets the setter UI in T5; the ring counts evidence-producing sessions in the current ISO week (Mon-UTC).
4. **Read model shape:** separate scoped queries, not a mega-field — `mistakesHub`, `todayHub`, `flashcardDecksHub`, `quizHistoryHub`, `analyticsSeries`, `weeklyGoal` (+ the `setWeeklyGoal` mutation), `badgeState`. Each answers on the scoping context; week/day boundaries Timecop-tested; codegen once at T1.
