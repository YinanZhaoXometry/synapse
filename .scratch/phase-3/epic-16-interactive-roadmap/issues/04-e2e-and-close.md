# 04: E2E + close — stub-provider graph, critical-flow coverage, live smoke, spine delta record

**What to build:** the interactive roadmap is provably working end to end and honestly recorded. The e2e stub AI provider emits a fixed 16-node, edge-carrying proposal (including an optional node and one deliberately invalid edge that must be dropped); the critical-flow suite covers the graph surface against the live local stack; a dual-theme + reduced-motion live browser smoke exercises the 16-node graph; the spine's Deferred row and epic-10's delta-decision trail are amended; the phase board is updated and baselines recorded.

**Blocked by:** 3.

**Status:** done (2026-11-06 — T4 branch `p3-16/t04-e2e-close`: `a10b78d` + `746e87f`; gates: rspec 1325 · vitest 874 · e2e 19 passed + 1 opt-in smoke spec (5 tests) green · dual-theme+palette+reduced-motion live smoke PASS, screenshots reviewed)

**Bound by:** the e2e harness conventions (deterministic stub provider, self-isolating registered users, no live AI), the spine-maintenance discipline (delta decisions recorded where the original was made), grill decision 8 (clean-room honesty — the record states vocabulary-only inspiration).

- [x] Stub provider's proposal upgraded to the fixed 16-node graph: multi-stage, realistic forward edges, ≥1 optional node + descriptions, one invalid edge (backward or duplicate-title) that the flow drops — asserted absent in the rendered graph
- [x] E2E coverage: creation chat → confirm → graph renders with real arrows; node click → sheet (description + optional badge); `?node=` deep-link; progress bar counts; Graph-default view (List toggle intact)
- [x] Live browser smoke: 16-node plan, both themes (+ one non-default palette) + reduced-motion, fit-view + zoom + keyboard roving focus on the real stack — honest caveats recorded (the IAB guest rAF lesson from epic-08/10 applies)
- [x] Spine delta record: Deferred table's roadmap-renderer row amended (custom SVG retained; columns+derived → swimlanes+persisted edges+orthogonal routing); new deferred rows: roadmap editor, back-jump edges, touch pinch-zoom; epic-10 delta trail annotated
- [x] Phase-3 board updated (epic-16 done, baselines: rspec/vitest counts, e2e green); memory notes updated
- [x] Full gates green: `just spec` (web + api) + the e2e suite; any fixture/anti-drift interplay verified (mastery vectors untouched by construction — asserted)

## Comments

- (none yet)
