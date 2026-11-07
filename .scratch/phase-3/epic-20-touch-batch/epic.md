# Epic 20 (Phase 3) — touch batch: canvas pinch-zoom + drawer swipe-to-close

Status: **done** (closed 2026-11-07; T1 @ 5fb9934 2026-11-06, T2 @ 5f494b9 + T3 close-out 2026-11-07, all on `epic/p3-20-touch-batch`; final baselines vitest 949 · e2e 21 @ workers=2 · touch smoke 2/2 · rspec untouched)
Milestone: Phase 3 — optimization season

## Close-out (2026-11-07)

- The epic's one cross-cutting discovery: **pointer capture must ride the ENGAGE moment, never pointerdown** — an active capture retargets the subsequent click to the capturing surface (W3C pointerevents#356, spec behavior), so T1's pointerdown capture would have swallowed every real-browser node tap and T2's would have bricked every tap-close path. jsdom doesn't model capture retargeting; only the real-Chromium smoke could see it. Both surfaces fixed + smoke-verified.
- The T3 smoke's second catch: restoring the drawer's entrance-animation classes after a spring-back REPLAYS the slide-in (the panel teleports off-screen mid-tap and eats the pointerup). The entrance now runs exactly once per open session (`swipedOnceRef`), vitest-pinned.
- e2e caught a pre-existing main regression on its first post-72f818a run: two same-name sign-out buttons on /settings (strict violation) — fixed by testid + re-pointed specs.
- Isolation recipe for parallel e2e/smoke runs beside a live demo stack (this worktree's gitignored `backend/.dockerdev/compose.override.yaml`): dedicated compose project + ports 13000/19000 + a throwaway Vite proxy override (the host :3000 is an unrelated ssh tunnel on this machine).
- Honest scope notes: drawer `touch-action: pan-y` (canvas-scoped `none` in decision 4); no physical-device smoke (CDP touch + mouse-pointer fidelity notes in ticket 03); focus trap/body-scroll lock stays recorded out of scope.

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
