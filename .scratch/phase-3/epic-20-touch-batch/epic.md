# Epic 20 (Phase 3) — touch batch: canvas pinch-zoom + drawer swipe-to-close

Status: ready-for-agent (spec'd + ticketed 2026-11-06, one pass under the standing decide-all delegation; grill round 1 self-answered — see spec decisions 1–7)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) row 20 · closes the spine touch row (pointer-drag pan + wheel/buttons ship today; pinch + drawer gestures deferred — until now) · AD-9 (keyboard contract untouched — every existing assertion survives) · NFR-6 (zero new deps — hand-rolled pointer math, no vaul migration) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-canvas-pinch.md](issues/01-canvas-pinch.md) | — (starts when epic-19 is merged) | two-pointer pinch-zoom + two-finger pan, midpoint-anchored, continuous within clamp; drag arbitration; touch-action + iOS gesture guards; reduce-motion pin; vitest suite |
| 2 | [02-drawer-swipe-close.md](issues/02-drawer-swipe-close.md) | — (independent file; serial lane regardless) | hand-rolled swipe-to-close on the nav drawer, scrim/Escape/nav-close intact, first-ever AppLayout drawer tests |
| 3 | [03-close.md](issues/03-close.md) | 1, 2 | spine touch row shipped; board row done; smoke verdicts archived |

## Definition of done

Canvas pinch works continuous-within-clamp with midpoint anchoring; wheel/buttons invariants byte-identical (their tests untouched); one-finger pan + node taps survive; drawer swipe-closes with spring-back and all prior close paths intact; reduce-motion honored on both new motions; AD-9 keyboard suite regression-free; vitest ≥ 920, e2e 21 green; spine + board honest.

## Coordination notes

- Recon: /tmp/synapse-phase3-notes/epic-20-recon.md (pan/wheel implementation, exact assertion shapes, drawer anatomy, touch policy vacuum).
- T1 and T2 touch disjoint files (RoadmapGraph vs AppLayout) but the lane is serial — single-implementer cadence.
- vaul deliberately NOT adopted and NOT removed (spec decision 5) — its ui/drawer.tsx scaffold wrapper stays for the flashcards surface to consider.

## Kickoff delta review — 2026-11-06 (grill round 1 self-answered)

The seven spec decisions carry the rulings; the three with weight:
1. **Continuous pinch, stepped wheel** (decision 1) — one clamp, two postures; the wheel/buttons tests are the invariants that must not move.
2. **One gesture handler for pinch+two-finger-pan with midpoint anchoring** (decision 2/3) — drag killed on second pointer, gesture ends when either lifts (no mid-gesture pan handoff), taps never swallowed.
3. **No vaul** (decision 5) — hand-rolled swipe on the existing panel; vaul stays as scaffold residue for the flashcards surface to weigh.
