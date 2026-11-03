# 04: Roadmap graph — interactive, stage-grouped, 30+ nodes usable (FR-5, OQ-2)

**What to build:** the plan's roadmap.sh-style node graph: nodes grouped by stage, sequence edges, click → node detail (states from T3); **renderer chosen at delta-grill** (graph library vs custom SVG — OQ-2's deferred trigger; criteria: 30+ node layout quality, bundle cost, lazy-import posture); pan/zoom + keyboard navigation; detail panel or side sheet per UX spine.

**Blocked by:** 3.

**Status:** ready-for-agent (delta-grill: renderer decision FIRST)

**Bound by:** FR-5 (structure-faithful, interactive), AD-9 (accessibility floor on a canvas-ish surface — keyboard path mandatory), NFR-6 (bundle discipline — lazy import if heavy).

- [ ] Renderer decision recorded in `## Comments` with the criteria trail
- [ ] 30+ node plan renders usable (browser smoke, both themes, reduced-motion)
- [ ] Click/detail/keyboard navigation complete; states integrate
