# 02: Spine layout — one deterministic hub-and-spoke engine replaces both (FR-5 layout rework)

**What to build:** a single pure layout module producing the roadmap.sh geometry — stage hubs stacked on a vertical center spine, each stage's nodes fanned left/right, prerequisites routed as dotted curves, same-stage pairs as short outer arcs. After this ticket the layout exists, tested, and is consumed by nothing yet (T3 swaps the renderer over).

**Blocked by:** None (parallel with 01).

**Status:** ready-for-agent

**Bound by:** FR-5; the ≤16-node scale cap (epic-16 grill decision 3); NFR-6 (zero new runtime deps — pure TS math); determinism contract inherited from the epic-16 layout suites (byte-identical under shuffled input).

- [ ] New pure module (frontend/src/features/plans/, sibling of the retiring engines): input = nodes `{id, order, stage, optional}` + edges `{from, to}`; output = canvas dimensions, per-node boxes (hub boxes + leaf boxes), per-edge geometry with class `spine | fan | prereq`, hub metadata (stage title + mastered-count slot filled by the renderer, not the layout)
- [ ] Stage order: by first appearance in `order` (epic-10 convention preserved); stage-less nodes attach to a synthetic trailing 「未分组」 hub (i18n of the title stays the renderer's job — the layout emits a stable sentinel key)
- [ ] Side assignment deterministic: balance leaf counts left/right (alternating assignment by sorted node id within the stage; deterministic tie-breaks everywhere — no Math.random, no Date)
- [ ] Geometry constants from the measured rhythm: node box 297×51, rx 5, ROW_GAP ≈ 7 within a fan, column (fan) gap ≈ 46, hub vertical rhythm and spine margins derived from the same measurements (constants exported; renderer imports, never re-derives)
- [ ] Edge routing: spine edges = straight vertical hub-to-hub; fan edges = dotted bezier hub-port → leaf-port (control points at the column midline, roadmap.sh's S-curve shape); prereq edges = dotted curve between sibling leaves (same-stage → short outer arc around the fan; cross-stage → long curve riding the outer side); no arrowheads anywhere (direction is top-down geometric — epic-16's arrowhead vocabulary retired by owner decision)
- [ ] Dirty-input posture inherited: unknown endpoints, self-pairs, duplicate edges dropped silently; empty input returns a valid minimal canvas (never negative/NaN)
- [ ] vitest: byte-identical determinism under shuffled input; hub stacking order; side balance + tie-breaks; synthetic ungrouped hub; same-stage arc vs cross-stage curve classing; spine/fan/prereq classing table; 16-node mixed case snapshot; empty-input positive canvas; dirty-input drops. Prior art: the two retiring layout suites are the direct template
- [ ] web gates green for the new module (tsc/eslint/vitest)

## Comments

- (none yet)
