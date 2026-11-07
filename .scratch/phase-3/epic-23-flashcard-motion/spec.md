# Spec: Epic 23 (Phase 3) — Flashcard study motion: bottom-up flip, deck-exit choreography

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-06 under the standing decide-all delegation (grill round 1 went unanswered —
> all four questions self-answered with recommendations applied; every decision is logged in the
> epic's grill record and is one spec line, vetoable asynchronously). Grounded in a code recon of
> the flashcards feature @ main `1bc23de`. Owner's ask, verbatim intent: card flips bottom-to-top
> on tap (front → back); on advance the current card sweeps out diagonally to the right, fully off
> screen; industry-standard deck feel ("就按业界的这个惯常做法").

## Problem Statement

The flashcard study session is visually dead. Flipping swaps the card's content instantly with no
motion — the front simply disappears and the back appears — and advancing to the next card
hard-cuts. The session reads as a form, not a deck of cards. Every other study surface in the app
has motion character (sheet-ups, pops, confetti); flashcards, the most tactile metaphor in the
product, is the one that feels least like handling real cards.

## Solution

Industry-standard deck choreography, purely additive: tapping (or Space / the flip button) flips
the card bottom-edge-up around its horizontal axis — the card rotates to edge-on, the answer
swaps in exactly at the edge-on midpoint, and the card settles showing the back. On advance, the
index moves immediately and the outgoing card sweeps off to the right with a slight tilt and fade
(as if discarded off a deck) while the incoming card settles in from the left; "previous" mirrors
the whole thing. One or two static card edges peek out behind the current card (decorative deck
stack). No new dependencies, no behavior change: every interaction contract, testid, and the
NFR-8 honesty rule (back content not in the DOM before the flip) survive untouched.

## Seams (to-spec step 2 — logged under delegation)

- **Primary (existing):** the study-session render seam — the existing component test suite's
  behavior assertions (flip mechanics, front-first-after-advance, persist-then-advance rating,
  Esc/summary/restart) are the contract and must pass unmodified.
- **One new seam:** a feature-local pure motion module (prior art: the feature's existing
  display-shaping selector module) owning the flip phase machine and the ghost lifecycle as pure
  state transitions. The component maps machine state to CSS classes; `animationend` events
  dispatch back into the machine. All visuals live in CSS keyframes; the machine is directly
  unit-testable without rendering.

## User Stories

1. As a learner, I want the card to flip bottom-edge-up when I tap the front, so that revealing
   the answer feels like lifting a real card instead of a content swap.
2. As a learner, I want the answer to swap in exactly at the edge-on midpoint of the flip, so
   that the reveal lands at the moment the card is visually "turned" — never before.
3. As a learner, I want the current card to sweep out to the right — past the viewport edge,
   with a slight upward drift, a clockwise tilt, and a fade — when I advance, so that finishing
   a card feels like tossing it off the deck.
4. As a learner, I want the next card to arrive while the old one is still exiting, so that the
   review rhythm never stalls behind an animation.
5. As a learner, I want "previous" to mirror "next" — sweep out to the left with a mirrored
   tilt — so that moving back and forth feels symmetric and predictable.
6. As a learner, I want one or two static card edges peeking out behind the current card, so
   that the session reads as a deck I am working through, not a lone slide.
7. As a learner, I want the last card to exit with the same sweep before the summary appears,
   so that finishing carries the same tactile rhythm as every other advance.
8. As a learner who enabled reduce-motion (or whose OS requests it), I want every animation to
   collapse to an instant swap, so that the session stays comfortable and the behavior is
   identical to today's.
9. As a keyboard-only learner, I want tap / Space / flip button / ← → / Esc to keep their exact
   current behavior, so that muscle memory survives the visual upgrade untouched (AD-9).
10. As a screen-reader user, I want the back content to enter the accessibility tree only once
    the flip has begun (as today), so that the answer is never leaked early.
11. As a learner in dark mode or any palette (sunset/twilight/aurora), I want the motion visuals
    drawn entirely from semantic tokens, so that the deck looks native in every theme.
12. As a fast-clicking learner, I want rapid advances (rate-then-next, double-next) to spawn one
    independent exiting ghost per card — no tearing, no stuck cards, no dead clicks, so that
    speed never breaks the surface.
13. As a learner on phone or tablet widths, I want the same choreography at small sizes, so
    that mobile review is equally polished.
14. As the maintainer, I want the animation layer to be purely additive — zero changes to rating
    semantics, mastery behavior, routing, data hooks, or any existing testid — so that the
    feature carries no regression risk beyond its own module.

## Implementation Decisions

- **Pure CSS/Tailwind keyframes only — no framer-motion.** framer-motion sits in dependencies
  with zero imports (scaffold residue); adopting it would fight epic-19's bundle-split lane and
  the repo's NFR-6 discipline, while CSS delivers identical visuals with the existing global
  reduce-motion collapse applying for free. Keyframes register in the theme config's existing
  keyframes/animation blocks, named per the existing entries' convention, using the repo's
  standard easings (`cubic-bezier(0.32,0.72,0,1)` family).
- **Flip = rotateX bottom-edge-up with a mid-swap at 90°.** The card shell carries perspective;
  the flip runs as two half-phases — front rotates to edge-on (felt direction: the bottom edge
  sweeps up and over toward the top, "从下往上"; exact sign verified visually in the browser
  smoke), the back content mounts exactly at the edge-on midpoint, then the card settles showing
  the back. Total ~320ms (two ~160ms halves). The mid-swap preserves NFR-8 by construction: the
  back's render semantics remain "not in the DOM until the flip begins" — the existing render
  tests pass unmodified, and screen readers gain the answer no earlier than today.
- **Advance choreography = immediate index advance + decorative ghost.** On any advance (next
  button, →, or a successful rating persist — persist-then-advance is unchanged), the deck index
  moves first; the outgoing card unmounts from the live slot and re-mounts as an aria-hidden,
  content-free ghost (no testids — keeps the test namespace collision-free) that plays the exit
  keyframes: translateX past the right viewport edge with slight upward drift + clockwise tilt +
  fade, ~320ms; the ghost removes itself on `animationend` with a timeout fallback. The incoming
  card plays a short settle-in (~240ms fade + small offset). Rapid navigation spawns one keyed
  ghost per outgoing card — ghosts are independent and never block input.
- **Previous mirrors next:** exit sweeps left with a counterclockwise tilt; the incoming card
  settles in from the right. Same ghost mechanics, mirrored keyframes.
- **Deck stack = static, decorative, honest.** One or two static card edges behind the card
  shell (semantic tokens only — card/border/shadow vocabulary, no hardcoded whites or palette
  rgba), `aria-hidden`, no interaction, hidden at the summary. The stack does not shrink with
  remaining count (a reactive stack would animate the deck's honesty — out of scope).
- **Summary handoff:** the final advance plays the same ghost exit; the summary panel mounts
  with the app's existing entrance vocabulary (fade/slide-up).
- **Interaction surface unchanged:** click card / Space / flip button flip; next / → / successful
  rating advance; prev / ← go back; Esc exits. No new i18n keys (all added visuals are
  aria-hidden decorative or already-labeled controls).
- **Styling discipline:** conditional classes via the repo's `cn()` helper; every color/shadow
  from semantic tokens; both modes and all palettes hold (verified in the close-out ticket).
- **Reduce-motion needs no JS branch:** the two existing global rules (OS media query +
  `body.reduce-motion`) collapse all animation durations to ~0, so `animationend` fires
  immediately and the machine settles instantly — behavior equals today's. Verified, not
  special-cased.

## Testing Decisions

- Good tests assert external behavior only — never class names or keyframe internals. The
  existing study-session suite is the regression contract: flip mechanics, NFR-8
  (back-not-in-DOM before flip), front-first after navigation, persist-then-advance rating,
  latest-wins re-rate, Esc, summary distribution, restart — all pass unmodified.
- The pure motion module gets direct unit tests (the feature's selector-module prior art): the
  flip machine passes through exactly one mid-swap per flip; ghost lifecycle adds on advance and
  removes on completion event; rapid advances spawn independent ghosts; a synthetic
  immediate-completion event (the reduce-motion collapse) settles the machine with no lingering
  ghosts.
- New render assertions, minimal: after an advance, the live slot shows the new card front-first
  and the exiting card leaves no testid trace; the deck stack is `aria-hidden` and invisible to
  queries; the summary flow keeps its existing assertions green.
- jsdom has no real animation rendering — tests drive the machine through events, not CSS
  outcomes; the visual truth is the browser smoke (dual theme, reduce-motion on/off, three
  viewports) in the close-out ticket.
- i18n parity stays green with zero new keys. Gates: the standard web gates (typecheck, lint,
  vitest, build); no backend, codegen, or mastery-vector impact.

## Out of Scope

- framer-motion adoption; deleting the unused framer-motion dependency (epic-19 bundle-split
  owns dependency hygiene — the observation is handed to it as input).
- Drag/swipe gestures on the card (epic-20 owns the touch-gesture batch; a card swipe-to-advance
  is parked as its follow-up candidate, recorded in the epic).
- 3D flourishes beyond the flip (mirrored back face during rotation, parallax depth, card
  shadows reacting to flip angle).
- Reactive deck stack (layer count reflecting remaining cards), sounds/haptics, end-of-deck
  confetti (celebration vocabulary belongs to achievements).
- Any change to rating semantics, spaced-repetition scheduling, or mastery behavior — self-rating
  stays evidence-free per ADR-0001.
- Hub page, launcher, or generation-flow changes (study-session surface only; all three entry
  routes share the session shell and inherit the motion automatically).

## Further Notes

- Queue position: **after epic-22** per the owner's fresh 18–22 nomination (single lane
  respected). Code-independent of 18–22 (no shared files); pulling it forward is a one-line
  board move if the owner wants the demo polish sooner.
- Grill record (round 1, self-answered under delegation): ① queue position → epic-23 after 22;
  ② flip mechanism → mid-swap at 90° preserving NFR-8 (true-3D double-face rejected: it would
  relax the honesty contract and its render tests + add aria-leak surface); ③ prev → mirrored
  exit; ④ deck stack → yes, subtle static. Each is one spec line, vetoable asynchronously.
- Baselines at authoring: main `1bc23de`, rspec 1384 / vitest 875 / e2e green (post-epic-16/17).
