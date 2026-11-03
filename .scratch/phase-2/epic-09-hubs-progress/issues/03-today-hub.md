# 03: Today hub — `/planner` becomes 今日学习 (FR-27)

**What to build:** the Planner page re-points to the daily list: due Re-queue reviews (epic-07 `dueItems`) + user-added manual tasks (+ AI-suggestion slot — v1 may ship dues+manual, suggestions flagged partial per delta-grill); each item with duration estimate, priority, completion toggle; day-progress summary + light week strip (calendar browsing stays demoted); zh label **今日学习** (学习计划 reserved for Study Plan).

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-27 (item shapes, label rule, trace-to-gap for suggestions), AD-9 (bilingual floor), AD-13 (manual tasks persist user-scoped — needs a small api op; add in this ticket).

- [ ] Due items appear on their due date, completable, deep-linked into study flow
- [ ] Manual task add/complete/toggle persists (new op passes scoping context)
- [ ] Label rule verified zh+en; suggestions (if v1) trace to their mastery gap
