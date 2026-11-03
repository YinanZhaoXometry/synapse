# 03: Score + streak resolver bodies on the wire

**What to build:** implement the `masteryScore`/state + plan-rollup + streak resolver bodies on the GraphQL types epic-03 hosts (KnowledgeNode, StudyPlan, per epic-03 ticket 1's recorded placement decision), backed by the Ruby module; specs build evidence graphs via factories and assert scores move only on evidence (uncovered-never-green, marking-never-moves asserted once more server-side).

**Blocked by:** 2; epic-03's types landed.

**Status:** ready-for-agent

**Bound by:** AD-14 (client renders, never recomputes — this is the only score source), AD-13 (scoping — scores ride user-scoped entities), FR-15 rule (claim ≠ evidence).

- [ ] Fields answer over GraphQL against factory evidence graphs, matching fixture expectations
- [ ] Marking/claim writes leave scores unchanged (spec)
- [ ] Cross-user read of a score-bearing entity blocked by scoping context
