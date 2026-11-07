# 02: Drawer swipe-to-close — hand-rolled, thresholds, spring-back

**What to build:** the mobile nav drawer closes by swiping left past a threshold (with spring-back below it), keeping scrim click / Escape / nav-close intact and gaining its first-ever tests.

**Blocked by:** None (independent file; serial lane regardless).

**Status:** done (2026-11-07, @ 5f494b9 on p3-20/t02-drawer-swipe)

**Bound by:** decision 5 of the spec (hand-rolled pointer math on the existing panel — NO vaul migration; vaul stays untouched in deps; focus trap/scroll lock recorded out of scope; reduceMotion respected for the spring transition), the existing drawer behaviors (scrim L252 / Escape L29-36 / nav-close L284 / search-footer L273,290 in AppLayout.tsx).

- [x] Pointer-based swipe on the drawer panel: track horizontal drag; translate the panel with the pointer while dragging (transform, not layout); dismiss when past `min(40% of panel width, 120px)`; below it, spring back to open (transition only when reduce-motion is off); a tap (no meaningful drag) does not close
- [x] All existing close paths regression-tested: scrim click, Escape, nav-link click, search pill, footer
- [x] First AppLayout drawer tests (vitest): open via hamburger; swipe-past-threshold closes; sub-threshold springs back; tap does not close; scrim/Escape/nav still close; aria-expanded on the hamburger tracks state
- [x] i18n: no new user-facing strings expected (aria labels already exist; add only if the implementation surfaces one — {zh, en} if so) — none surfaced
- [x] web gates green (codegen zero-diff; tsc; eslint; vitest ≥ baseline grown; build) — vitest 948/948 (+16 drawer tests over the merged baseline), build index 717.67 kB (< 800 tripwire)

## Comments

- 2026-11-07: two-axis code review caught two REAL-browser bugs the jsdom tests are blind to (jsdom doesn't model capture retargeting): (1) `setPointerCapture` at pointerdown retargets the subsequent click to the panel (W3C pointerevents#356, spec behavior) — bricked every tap-close path in real browsers; capture now rides the ENGAGE moment (first move past the 8px slop), so taps never capture. (2) `springBack` was never cleared by a new gesture — one sub-threshold swipe left the click-capture guard swallowing all later taps; now reset on every pointerdown. Both pinned by new regression tests (16 total).
- 2026-11-07: same review finding applied back to T1 (same lane): the roadmap canvas' pointerdown capture had the identical retargeting bug against node taps — moved to the first drag move (5f494b9, RoadmapGraph.tsx); T1's 41 tests untouched and green.
- 2026-11-07: branch additionally carries merge-of-main @ 72f818a (demo-prep UX round touched the same AppLayout drawer footer — UserMenuButton — resolved now rather than at epic merge; epic-16 lesson).
- Honest scope note: the drawer panel is `touch-action: pan-y` (horizontal gestures to the swipe, vertical scrolling stays native for the nav list) — the spec's `touch-action: none` language is canvas-scoped (decision 4); pan-y is the drawer-appropriate posture and is pinned by a test.
