# 05: Analytics + Dashboard re-point + weekly goal (FR-26/25)

**What to build:** `/analytics` renders real series — Mastery by Knowledge Node (topic-strength pattern), quiz-accuracy trend over weeks, study consistency (scaffold recharts patterns kept, demo data retired, AI-vs-manual charts stay excluded as legacy); `/dashboard` re-points at plan evidence — greeting, streak, KPI cards, quick actions, recent achievements + the **weekly study goal ring** counting evidence-producing sessions (never minutes); both bilingual/theme-complete.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-26 (the three series; legacy exclusion), FR-25 Phase-2 halves (weekly goal; full Roadmap graph stays epic-10), SM-C3 (sessions not minutes), AD-14 (server-computed streak/series only).

- [ ] All series populated from factory evidence; week boundaries correct
- [ ] Weekly goal settable + ring honest (partial weeks handled)
- [ ] No demo-data fallbacks remain on either page; `UserProgressContext` reads removed from both (retirement completion with T6)
