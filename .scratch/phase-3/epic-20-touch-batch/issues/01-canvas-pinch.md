# 01: Canvas pinch — two-pointer zoom + two-finger pan, midpoint-anchored

**What to build:** pinch to zoom the roadmap canvas (continuous within the existing clamp, anchored at the gesture midpoint), two-finger translate, one-finger drag pan and node taps unchanged, wheel/buttons invariants byte-identical, touch-action + iOS gesture guards, reduce-motion honored.

**Blocked by:** None (starts when epic-19 is merged).

**Status:** ready-for-agent

**Bound by:** decisions 1–4, 6, 7 of the spec (continuous-within-clamp; midpoint anchor math `pan' = m − ((m − pan)/k0)·k1`; second-pointer kills the drag, either-lift ends the gesture, taps never swallowed; touch-action:none + gesture preventDefault, NO user-scalable change; keyboard contract untouched; vitest-first, no hasTouch project), NFR-6 (zero new deps).

- [ ] Pinch gesture handler on the canvas container (pointer events; a `pointersRef` map keyed by pointerId; second `pointerdown` cancels `dragRef` and enters pinch; either `pointerup`/`pointercancel` ends the whole gesture): distance ratio k1/k0 → `clampZoom` (continuous 0.5–2), midpoint anchor per the spec formula (pan co-varies), midpoint delta → two-finger pan
- [ ] `touch-action: none` on the canvas container; defensive non-passive `gesturestart`/`gesturechange` preventDefault listeners (Safari); the existing wheel handler and clamps untouched
- [ ] Vitest (red first, exact-transform house style): pinch sequence (two pointerDowns + moves + ups) → clamped continuous scale + midpoint-stable content point; two-finger pan; clamp at 0.5 and 2; drag canceled by second pointer (transform unchanged by the pre-pinch drag); single-pointer pan regression (existing tests stay green); wheel/buttons step invariants (existing tests stay green); node tap after a completed pinch opens the sheet; touch-action attribute + gesture listeners present; reduce-motion: the viewport transition class stays gated on `data-motion` (pinch sets state instantly, transition only when motion on)
- [ ] AD-9 guard: every existing RoadmapGraph assertion passes untouched (the deep-link/fit-view/keyboard pins are the regression fence)
- [ ] web gates green (codegen zero-diff — no schema change; tsc; eslint; vitest ≥ 920; build)

## Comments

- (none yet)
