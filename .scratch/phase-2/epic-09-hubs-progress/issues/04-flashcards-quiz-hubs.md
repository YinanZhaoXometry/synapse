# 04: Flashcards + Quiz hubs — `/flashcards` `/quiz` re-point (FR-41/42)

**What to build:** `/flashcards`: every generated deck across plans/tasks, grouped/filterable, flip-card study launchable from the hub (review surface — generation stays in-flow per FR-19/FR-36); `/quiz`: full history with scores + per-question results, **retake** from the hub — a new session seeded from the old scope/mode, producing fresh evidence (NFR-8 no-repeat-inflation).

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-41/42 (aggregation, origins, retake), AD-8 (sessions are sub-routes, never modals), AD-6 (retake evidence attributed at generation).

- [ ] Hub lists every deck/session from factory data; filters by plan/task
- [ ] Hub-launched study works without entering plan flow; routes are addressable sub-routes
- [ ] Retake produces a distinct session + new evidence records (integration spec)
