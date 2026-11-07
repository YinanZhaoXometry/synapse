# 01: Flip motion — pure motion module, rotateX bottom-edge-up flip with mid-swap at 90°

**What to build:** the learner's flip becomes tactile. Tapping the card (or Space, or the flip button — all existing triggers) runs a bottom-edge-up rotation: the front rotates to edge-on, the answer swaps in exactly at that midpoint, and the card settles showing the back; flipping again reverses it. To the learner this is one continuous ~320ms flip; to the DOM it is still conditional render — the back mounts only once the flip has begun, so the honesty rule and every existing render test survive untouched. All visuals are CSS keyframes driven by a new feature-local pure motion module (flip phase machine + ghost lifecycle); the component maps machine state to classes and dispatches animation events back.

**Blocked by:** None (epic gate — can start immediately).

**Status:** ready-for-agent

**Bound by:** NFR-6 (zero new dependencies — CSS keyframes only; framer-motion stays unimported), AD-9 (keyboard + aria contract unchanged), spec flip decision ② (mid-swap at 90°, true-3D double-face rejected).

- [ ] Pure motion module in the feature (selector-module prior art): flip phase machine + ghost lifecycle as pure state transitions; directly unit-tested — one flip passes through exactly one mid-swap; a synthetic immediate-completion event (the reduce-motion collapse) settles with no lingering state
- [ ] Flip keyframes registered in the theme config's existing keyframes/animation blocks (naming per the existing entries; repo standard easings); perspective on the card shell; conditional classes via `cn()`
- [ ] Felt direction: the bottom edge sweeps up and over ("从下往上") — rotation sign verified visually, pinned with a comment
- [ ] NFR-8 render tests pass unmodified: back content mounts only at the edge-on midpoint (equivalent to today's "not in DOM before flip"); screen readers gain the answer no earlier than today
- [ ] Flip triggers unchanged and flip-back works: click card / Space / flip button
- [ ] Every existing study-session test passes unmodified (the suite is the regression contract)
- [ ] web gates green (typecheck, lint, vitest, build)

## Comments

- (none yet)
