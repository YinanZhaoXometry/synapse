# Spec: Epic 20 (Phase 3) — touch batch: pinch-zoom the roadmap canvas, swipe-to-close the drawer

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-06 under the standing decide-all delegation (grill round 1 self-answered from
> recon: /tmp/synapse-phase3-notes/epic-20-recon.md). Owner nomination 2026-11-06. Gate: epic-19
> merged (serial lane).

## Problem statement

On a touch device the roadmap canvas is a dead surface: one-finger drag does nothing (the browser
reads it as page scroll inside `overflow-hidden`), two-finger pinch zooms the PAGE (there is no
`touch-action` anywhere, and the viewport meta keeps page zoom enabled), and the wheel/buttons
posture is unreachable without a mouse. The mobile nav drawer opens by tap and closes only by tap
— no swipe affordance at all. The spine row ("pointer-drag pan + wheel/buttons zoom ship today;
pinch deferred") is exactly this backlog.

## Solution — three tickets

1. **T1 canvas pinch:** two-pointer pinch-zoom + two-finger pan on the roadmap canvas — continuous
   distance-ratio into the existing `clampZoom` (0.5–2), anchored at the gesture midpoint (the
   content under the fingers stays under the fingers), one-finger drag pan unchanged, node taps
   survive; `touch-action: none` on the canvas + defensive iOS `gesturestart/gesturechange`
   `preventDefault`; reduce-motion honored; the wheel/buttons invariants untouched.
2. **T2 drawer swipe-to-close:** the hand-rolled left drawer gains a pointer swipe-to-close (drag
   left past a threshold dismisses; below it springs back), keeping scrim click / Escape /
   nav-close intact; a tap still opens. No vaul migration.
3. **T3 close:** spine row updated; board row done.

## Implementation decisions (grill round 1 — self-answered)

1. **Continuous pinch, stepped wheel/buttons.** The pinch feeds the raw distance ratio into the
   shared `clampZoom` — free-form within 0.5–2 (the roadmap.sh feel). The wheel/buttons KEEP their
   0.25-step invariant verbatim; their tests must pass untouched. One clamp, two postures.
2. **Midpoint-anchored.** On every scale change k0→k1 around midpoint m: the content point under m
   stays under m (`pan' = m − ((m − pan)/k0)·k1`). The same gesture tracks the midpoint for
   two-finger PAN (midpoint delta translates to pan) — pinch and two-finger pan are one gesture
   handler, the standard maps feel. New math pinned by exact-transform tests.
3. **Gesture arbitration: two pointers kill the drag.** First pointer down starts a pan candidate
   (existing `dragRef`); the SECOND pointer down cancels it (`dragRef = null`) and enters pinch
   mode tracking both pointers. When either pointer lifts, the gesture ENDS entirely (no mid-gesture
   transition to one-finger pan — that revert is a rabbit hole); pan resumes on a fresh
   single-pointer drag. Single-pointer tap → click synthesis is never swallowed: the pinch path
   only activates on a second `pointerdown` and does not interfere with the single-pointer case.
4. **`touch-action: none` on the canvas container** (the fixed-height surface — no page-scroll
   regression is possible inside it, and it is what actually stops the browser pinch). Plus
   defensive `gesturestart`/`gesturechange` `preventDefault` listeners on the canvas for Safari's
   legacy gesture events. The page's pinch-zoom stays enabled everywhere else — **no
   `user-scalable` meta change** (accessibility).
5. **Drawer = hand-rolled swipe-to-close, no vaul migration.** vaul is dead scaffold residue (zero
   imports; bottom-sheet posture); integrating it would replace working scrim/Escape/nav-close
   with a library integration for one gesture. The swipe is pointer math on the existing panel:
   drag left beyond a threshold (~40% of panel width or 120px, whichever is smaller) dismisses;
   below it, the panel springs back (respecting `reduceMotion` for the spring transition). The
   drawer keeps its left-slide position; scrim click / Escape / nav-close unchanged. Focus trap +
   body-scroll lock are a pre-existing a11y gap, NOT touch scope (recorded, not built). vaul stays
   in deps untouched (its `ui/drawer.tsx` wrapper is scaffold the flashcards surface may yet
   adopt; removal is not this epic's call).
6. **AD-9 keyboard contract untouched:** the wheel/buttons/pan/fit-view/deep-link behavior and
   their exact-transform test pins are out of the diff's blast radius except where the pinch adds
   listeners. Every existing RoadmapGraph assertion must survive.
7. **Test posture: vitest-first.** Two-pointer sequences via the existing PointerEvent shim
   (`fireEvent.pointerDown` ×2 + moves), exact-transform asserts (the house style), plus: drag
   canceled by second pointer, tap-after-pinch opens the sheet, reduce-motion pin (transition
   class gated on `data-motion`), touch-action attribute present. **No Playwright hasTouch
   project** (two-finger simulation is awkward and the desktop suite covers the flows; recorded
   honestly).

## Testing decisions

- Vitest: pinch sequence → exact transform + clamp at 0.5/2; midpoint anchor math (the content
  point under the start midpoint stays put — assertable via pan/scale values); two-finger pan;
  drag-canceled-on-second-pointer; single-pointer pan unchanged; wheel/buttons step invariants
  unchanged; node tap survives a completed pinch; touch-action + gesture listeners present;
  reduce-motion. Drawer: swipe past threshold closes; below threshold springs back; scrim/Escape/
  nav-close regressions pinned (new AppLayout tests — the drawer was untested).
- e2e: no new specs (desktop suite unchanged; the smoke at close-out drives the surfaces).
- Gates: web full set (codegen zero-diff — no schema change; vitest ≥ 920; build) + e2e 21 green.

## Out of scope

- vaul migration; drawer focus trap / body-scroll lock (pre-existing a11y gap — recorded);
  `user-scalable` meta changes; Playwright touch project; pinch on ANY surface other than the
  roadmap canvas; double-tap-to-zoom; per-node touch targets resize.

## Further notes

- Spine update at T3: the touch row (L351) → shipped with the posture summary; the roadmap-editor
  row is untouched.
- Baselines at kickoff: rspec 1452 / vitest 920 / e2e 21 (post-epic-19 main).
