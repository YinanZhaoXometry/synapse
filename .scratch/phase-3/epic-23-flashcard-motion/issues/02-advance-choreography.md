# 02: Advance choreography — deck sweep-off, mirrored prev, deck stack, summary handoff

**What to build:** advancing feels like discarding a card off a deck. On any advance (next button, →, or a successful rating persist — persist-then-advance unchanged) the index moves first, then the outgoing card re-mounts as an aria-hidden, content-free ghost (no testids) that sweeps past the right viewport edge with an upward drift, a clockwise tilt, and a fade while the incoming card settles in from the left; "previous" mirrors the whole thing (left exit, counterclockwise tilt, settle from right). Rapid navigation spawns one independent keyed ghost per outgoing card and never blocks input. One or two static decorative card edges peek out behind the current card. The final advance plays the same exit before the summary mounts with the app's existing entrance vocabulary.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** NFR-6 (zero new dependencies), i18n mandate (zero new keys — all added visuals aria-hidden decorative), ADR-0001 (rating semantics untouched — persist-then-advance flow preserved exactly), spec grill decisions ③ (mirrored prev) + ④ (static deck stack).

- [ ] Exit keyframes: translateX past the right viewport edge + slight upward drift + clockwise tilt + fade, ~320ms, repo standard easing; mirrored prev variant (left exit, counterclockwise tilt) + mirrored settle-in (~240ms fade + offset)
- [ ] Ghost discipline: exiting card re-mounts aria-hidden and content-free with no testids (test namespace collision-free); removes itself on animationend with a timeout fallback
- [ ] Advance ordering: index moves immediately on next/→/successful rating persist; the exit animation never delays or gates the advance; existing persist-then-advance tests green unmodified
- [ ] Rapid navigation: one keyed ghost per outgoing card, ghosts independent, no dead clicks, no stuck cards
- [ ] Static deck stack: 1–2 aria-hidden decorative card edges behind the shell, semantic tokens only (no hardcoded whites / palette rgba), no interaction, hidden at the summary, non-reactive to remaining count
- [ ] Summary handoff: final advance plays the ghost exit, then the summary mounts with the existing fade/slide-up vocabulary; existing summary assertions green
- [ ] New render tests (minimal): after an advance the live slot is front-first with no testid trace of the exiting card; the deck stack is invisible to queries; jsdom drives the machine via events, not CSS outcomes
- [ ] web gates green (typecheck, lint, vitest, build)

## Comments

- (none yet)
