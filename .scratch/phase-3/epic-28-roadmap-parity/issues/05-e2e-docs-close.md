# 05: E2E + docs + close — spine in the harness, Study Mark on paper (FR-47 recorded)

**What to build:** the e2e harness asserts the spine experience and the mark flow; the domain addition lands in PRD/glossary/ADR; the two retired rulings and layout engines are recorded as history; the board closes the epic.

**Blocked by:** 04.

**Status:** done (2026-11-11)

**Bound by:** the e2e harness contract (stub AI provider, deterministic 16-node plan, fresh registered users); docs discipline (BMAD owns product docs — PRD edit is a delta record, not a rewrite); the spine delta-record convention (workflow.md).

- [ ] e2e `roadmap-graph.spec.ts` rewritten for the spine: creation → confirm → 16-node spine renders (hub cards + leaves + dotted fans + solid spine, no arrowheads); full-page scroll (assert the canvas grows beyond the viewport and page scroll reaches the last stage); mark a node from the hover chips → corner chip color/aria updates → reload → mark persists (server truth); progress bar unchanged by marks + mark-count line updates; chips actions navigate (去学习 → reader anchor; 节点速测 → quiz route)
- [ ] e2e `visual-smoke.spec.ts`: zoom/fit flows converted to scroll + keyboard flows (arrow traversal with scroll-into-view containment, Enter → sheet, dark-mode legibility of the copied yellows/blues, reduced-motion); upload/auth/loop specs' node-title lookups survive (SVG text inside `g[data-node-id]` convention)
- [ ] PRD: FR-47 (Study Mark) added to the FR table + §3 vocabulary entry; §6.2 ledger row added; a dated note marks the epic-16 "no manual marking" posture as superseded-by-owner-decision (2026-11-11) for the orthogonal mark only — evidence-only mastery (ADR-0001) unchanged
- [ ] GLOSSARY.md: **Study Mark** engineering term — enum `learning | finished | skipped`, nullable, revocable, self-declared; explicitly separate from the mastery-state vocabulary; mastery avoid-words stay avoided (UI copy 已完成, never "Done")
- [ ] ADR `docs/adr/`: Study Mark is orthogonal to mastery — the trade-off (self-tracking UX vs evidence-only honesty), the resolution (store + render, compute nothing), and the fuse conditions that would have to be true for marks to feed any computation (recorded so future work argues with the ADR, not vibes)
- [ ] Spine delta record: epic-16's two amended rulings (manual marking; style-parameter copy) + the retired engines (epic-10 derived-sequence, epic-16 swimlane DAG, epic-20 canvas pinch) with pointers to git history; board/roadmap.md updated; old layout modules + their suites deleted (imports swept)
- [ ] Full gates: `just spec` (web + api) + `just e2e` green; mastery-vector anti-drift untouched and passing; bundle check (the font asset + spine module accounted; no other drift)

## Comments

- (none yet)
