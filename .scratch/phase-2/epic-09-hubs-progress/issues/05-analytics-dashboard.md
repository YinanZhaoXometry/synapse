# 05: Analytics + Dashboard re-point + weekly goal (FR-26/25)

**What to build:** `/analytics` renders real series — Mastery by Knowledge Node (topic-strength pattern), quiz-accuracy trend over weeks, study consistency (scaffold recharts patterns kept, demo data retired, AI-vs-manual charts stay excluded as legacy); `/dashboard` re-points at plan evidence — greeting, streak, KPI cards, quick actions, recent achievements + the **weekly study goal ring** counting evidence-producing sessions (never minutes); both bilingual/theme-complete.

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-09-t05-analytics`; gates: backend untouched / vitest 629 / tsc + eslint + codegen + build green)

**Bound by:** FR-26 (the three series; legacy exclusion), FR-25 Phase-2 halves (weekly goal; full Roadmap graph stays epic-10), SM-C3 (sessions not minutes), AD-14 (server-computed streak/series only).

- [x] All series populated from factory evidence; week boundaries correct
- [x] Weekly goal settable + ring honest (partial weeks handled)
- [x] No demo-data fallbacks remain on either page; `UserProgressContext` reads removed from both (retirement completion with T6)

## Comments

Implementation landed 2026-11-05 (frontend only — backend needed nothing: T1's read model already
carried everything). **Ops:** `AnalyticsSeries` / `WeeklyGoal` / `BadgeStates` queries +
`SetWeeklyGoal` mutation added to `hubs.graphql`, codegen'd; typed hooks in `hub-queries.ts`
(`useAnalyticsSeriesQuery` / `useWeeklyGoalQuery` / `useBadgeStatesQuery` / `useSetWeeklyGoalMutation`
— the union-rebuild convention guards the node-state wire vocabulary; the setter's payload echo
writes the fresh weeklyGoal through the normalized cache, no refetch needed).

**/analytics (FR-26):** the three series render and nothing else — node-mastery bars ordered
weakest-first (score asc; raw server score% rendered verbatim; state through the shared
NodeStateBadge contract), the weekly accuracy trend (the scaffold's SVG bar-chart pattern kept,
fed by weeklyAccuracy; per-week accuracy = correct/answered rendering math; M/D week-start labels),
and the 14-day consistency strip (evidence days filled with their session count, zero days hollow,
today highlighted — a quiet day is still a day). Header stats count the returned series only
(nodes / latest-week accuracy / active days / 14-day sessions — SM-C3). The minutes/level/
AI-vs-manual remnants and the demo fixtures (week minutes, accuracy values, topic rows) retired;
residue absence asserted in the page + dictionary tests.

**/dashboard (FR-25):** time-of-day greeting (zh 早上好/下午好/晚上好 — `greetingKey(hour)` pure
seam; the hardcoded demo name dropped as residue), the server streak (T3's useStreakQuery
precedent), four KPI cards each deep-linking its hub (学习计划 → /plans with the nodes' mastered
count off analyticsSeries; 本周学习 → /planner from weeklyGoal; 连续记录 → /planner; 错题本 →
/mistakes from the mistakesHub length), the weekly goal ring honest on partial weeks
(currentWeekSessions/target, ratio capped at 100% — no projection; static SVG, so reduce-motion
holds trivially), plan-first quick actions on real routes (创建学习计划 → /plan/new, 今日学习 →
/planner, 快速测验 → /quiz), and the recent-unlocked badges summary off badgeState (the server
truth with a real none-yet empty state; the full page + progress labels stay T6's — the scaffold
emoji map rides inline until then). The fake continue-reading card retired.

**Weekly goal setter (delta decision 3):** Settings gains the 学习目标 section (the simple half,
between appearance and general — full surfaces stay epic-14): a number input over the SERVER's
current target with client-side 1..21 validation firing BEFORE `setWeeklyGoal`, sonner success /
neutral-error feedback, and the row rendered only once the read lands (no fake default).

**Retirement posture:** `UserProgressContext` reads removed from BOTH pages (source-guarded in
each page's tests); the context file and its remaining consumers (AchievementsPage + AppLayout +
Settings' probe) die in T6 per the epic plan — untouched here. demo-data's Analytics fixtures
retired with the T2/T3/T4 comment convention; remaining exports stay for their own tickets.
