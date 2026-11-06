# 02: Drawer swipe-to-close — hand-rolled, thresholds, spring-back

**What to build:** the mobile nav drawer closes by swiping left past a threshold (with spring-back below it), keeping scrim click / Escape / nav-close intact and gaining its first-ever tests.

**Blocked by:** None (independent file; serial lane regardless).

**Status:** ready-for-agent

**Bound by:** decision 5 of the spec (hand-rolled pointer math on the existing panel — NO vaul migration; vaul stays untouched in deps; focus trap/scroll lock recorded out of scope; reduceMotion respected for the spring transition), the existing drawer behaviors (scrim L252 / Escape L29-36 / nav-close L284 / search-footer L273,290 in AppLayout.tsx).

- [ ] Pointer-based swipe on the drawer panel: track horizontal drag; translate the panel with the pointer while dragging (transform, not layout); dismiss when past `min(40% of panel width, 120px)`; below it, spring back to open (transition only when reduce-motion is off); a tap (no meaningful drag) does not close
- [ ] All existing close paths regression-tested: scrim click, Escape, nav-link click, search pill, footer
- [ ] First AppLayout drawer tests (vitest): open via hamburger; swipe-past-threshold closes; sub-threshold springs back; tap does not close; scrim/Escape/nav still close; aria-expanded on the hamburger tracks state
- [ ] i18n: no new user-facing strings expected (aria labels already exist; add only if the implementation surfaces one — {zh, en} if so)
- [ ] web gates green (codegen zero-diff; tsc; eslint; vitest ≥ baseline grown; build)

## Comments

- (none yet)
