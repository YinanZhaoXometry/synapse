# 03: Graph UX — roadmap reading mode: node vocabulary, progress, deep-links (FR-5 UX half)

**What to build:** the plan graph becomes the roadmap.sh-grade reading experience on the existing custom-SVG canvas: real dependency arrows (orthogonal, replacing the bezier pseudo-edges), dashed optional nodes, tinted stage-group containers with per-stage progress, a plan progress bar (mastered x of y — server states only), fit-view, `?node=` deep-linking, hover tooltips, and the side sheet gains the node description + optional badge. The Graph view becomes the default (List one click away). The epic-10 keyboard contract (roving tabindex, pan-into-view, Esc) survives regression-free.

**Blocked by:** 2.

**Status:** done (2026-11-06 — landed `0c854ba`, `ed2d74c` on `epic/p3-16-roadmap`)

**Bound by:** AD-9 (keyboard path + not-color-only: dashed optional also carries a label/glyph; states keep glyphs), ADR-0001 + AD-6/14 (progress bar counts server `mastered` states — no manual marking surface of any kind), NFR-6 (no new dependencies), grill decisions 2/8 (reading mode only; roadmap.sh structural vocabulary mapped to semantic tokens, nothing copied).

- [ ] Edge-carrying plans render orthogonal dependency arrows; legacy fallback plans render unchanged through the fallback path
- [ ] Optional nodes: dashed border + a visible marker (not color-only), sheet carries the optional badge + description line
- [ ] Stage containers: tinted group backgrounds with stage title + per-stage progress (mastered/total from server states); plan progress bar above the canvas (mastered x of y + percent)
- [ ] Fit-view control recenters/rescales to the full roadmap; `?node=<id>` deep-link selects, pans into view, and opens the sheet on mount
- [ ] Hover tooltip on nodes (title + state; optional marker when present)
- [ ] Zoom posture per spec: plain wheel inside the canvas (ctrl/cmd+wheel alias); the visual target is the epic's style-reference mock — structure and interaction parity, colors via real semantic tokens (not the mock's inline approximations)
- [ ] Graph is the default view; List remains one click away; view choice does not break the existing e2e plan assertions
- [ ] Keyboard contract regression-free: every existing graph accessibility/keyboard assertion still passes (amended only where the new vocabulary adds surfaces); new surfaces carry aria labels
- [ ] i18n zh/en for every new string; semantic tokens only; both themes + reduce-motion honored
- [ ] Vitest component suite extended (progress counts from fixtures, deep-link mount behavior, fit-view, dashed optional, tooltip, default-view flip); web gates green

## Comments

- (none yet — live dual-theme browser smoke runs at T4 close, per the epic-10 close-out pattern)
