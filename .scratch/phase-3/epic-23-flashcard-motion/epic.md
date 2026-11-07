# Epic 23 (Phase 3) — Flashcard study motion: bottom-up flip, deck-exit choreography

Status: planned (spec'd + ticketed 2026-11-06; queued after epic-22 per the owner's 18–22 single lane — pulling forward is a one-line board move)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) · owner-requested polish on the Phase-1 flashcard study surface (PRD FR-19/20 flashcards, shipped) · AD-9 (a11y floor — keyboard contract, aria) · NFR-6 (bundle discipline — zero new dependencies) · ADR-0001 (untouched — self-rating stays evidence-free) · i18n mandate (no new keys; all added visuals aria-hidden decorative) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-flip-motion.md](issues/01-flip-motion.md) | — (epic gate) | pure motion module (flip machine + ghost lifecycle), rotateX bottom-edge-up flip with mid-swap at 90° (NFR-8 preserved), flip keyframes registered, all existing session tests green unmodified |
| 2 | [02-advance-choreography.md](issues/02-advance-choreography.md) | 1 | ghost exit/enter on advance (next → right sweep + tilt, prev mirrored), immediate-index-advance + independent ghosts under rapid navigation, static deck stack, summary handoff transition |
| 3 | [03-close-out.md](issues/03-close-out.md) | 2 | web gates green, browser smoke (dual theme/mode, palettes, reduce-motion on/off, three viewports), epic record + board update |

## Definition of done

Tapping/Space/flip-button flips bottom-edge-up with the answer swapping at the edge-on midpoint ·
advance sweeps the old card off right (prev mirrors left) while the new card settles in, index
advance never delayed · rapid navigation spawns independent ghosts · deck stack decorative +
aria-hidden · final card exits before the summary · every existing testid/test contract passes
unmodified (NFR-8 render tests included) · motion module directly unit-tested · zero new
dependencies, zero new i18n keys, zero backend/codegen/mastery contact · dual mode + all
palettes + reduce-motion + three viewports verified in a real browser · `just spec` web gates
green.

## Coordination notes

- Frontend-only, single feature module (the study-session component + one new pure module +
  theme-config keyframes). Code-disjoint from epics 18–22 (18 hub-tails, 19 bundle-split,
  20 touch-batch, 21 ai-proposal-quality, 22 roadmap-editor touch none of these files); safe to
  slot into any gap in the lane without rebase pain, though the board order keeps it last.
- The existing study-session suite is the regression contract — every assertion must survive
  unmodified; the animation layer is purely additive around it.
- framer-motion (declared, zero-import scaffold residue) stays untouched here — deletion is
  epic-19's call; this epic hands the observation to 19 as input.

## Grill record — 2026-11-06 (decide-all delegation; round 1 went unanswered, recommendations applied)

Grounded in code recon @ `1bc23de`: the card is single-face conditional render (back mounts only
on flip — NFR-8, render-test enforced), zero motion beyond shadow transitions; three entry routes
share one session shell; all test assertions ride testids, not classes; global reduce-motion
collapse (media query + `body.reduce-motion`) covers any CSS animation; framer-motion is an
unused dependency while epic-19 (bundle-split) is queued. The four owner questions and the
applied recommendations:

1. **Queue position** → new epic **23, after 22**. The owner nominated 18–22 as a single lane
   hours earlier; the new epic respects it and stays one board line from being pulled forward.
2. **Flip mechanism** → **rotateX with mid-swap at 90°**, preserving NFR-8 and every render test.
   True-3D double-face (preserve-3d + backface-visibility) rejected: it requires both faces
   resident in the DOM pre-flip, which would relax the honesty contract and its tests and add a
   screen-reader leak surface (aria-hidden layering) — for a visual that is, on opaque cards,
   indistinguishable from the mid-swap.
3. **Previous-card choreography** → **mirrored** (exit sweeps left, counterclockwise tilt;
   incoming settles from the right). Symmetric deck navigation is the industry norm the owner
   asked for.
4. **Deck stack backdrop** → **yes, subtle and static** (1–2 aria-hidden card edges, semantic
   tokens; non-reactive to remaining count — a deck that visibly empties would animate the
   session's honesty, a product decision never commissioned).
