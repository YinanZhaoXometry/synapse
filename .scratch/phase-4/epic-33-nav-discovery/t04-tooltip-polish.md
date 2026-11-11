# 04: Tooltip snappiness + exact centering + node Y padding

**What to build:** The owner's second feedback round on the roadmap chip strip (three fixes) plus one node-box tweak:

1. **Snappier hiding**: leaving a NODE (into empty canvas) currently keeps the strip up indefinitely — hiding was container-level only (the epic-28 stationary-pointer posture, needed when the strip sat flush on the node; T03's 8px gap made that hazard obsolete). Per-node `pointerLeave` now schedules the 120ms grace hide; the strip's own enter cancels it, the strip's leave schedules it; node enter cancels + re-intents; container leave stays as the final fallback.
2. **Exact center + closer**: the anchor's horizontal clamp (chipsHalf measurement + canvas clamp) is GONE — `left = node center X`, period (the lg+ layout leaves 320px+ of rail to the right of the canvas, so a centered strip on a right-column leaf paints over the rail, never past the viewport; touch never opens the strip). Gap: `bottom-2` (8px) → `bottom-1` (4px).
3. **Node Y padding**: SPINE_NODE_H 62→68, SPINE_ROW_PITCH 78→84 (row gap stays 16px) — more vertical breathing room inside both hub and leaf boxes.

**Blocked by:** None.

**Status:** done — shipped in PR #31 @ `09753c4` (2026-11-11)

- [ ] Per-node pointerLeave hides (120ms grace); strip enter cancels, strip leave schedules; container fallback kept; the 150ms intent + touch-never-opens contracts unchanged
- [ ] Anchor left = exact node-center X (clamp + chipsHalf measurement deleted); strip `bottom-1`
- [ ] SPINE_NODE_H 68 / SPINE_ROW_PITCH 84; gap stays ≥16px (overlap tests green)
- [ ] Tests updated: exact-center assertion, bottom-1, per-node-leave hides (NEW), strip-enter cancels (NEW)
- [ ] Gates green: tsc/eslint/vitest --coverage/build
