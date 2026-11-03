# 03: Annotations — multi-color highlight + underline (FR-16)

**What to build:** highlight (multiple colors) + underline on Markdown (section ranges) and PDF (text-layer ranges); persistent (user-scoped rows via the annotations entity), removable; a domain range shape (material + locator + range) the reader maps its engine onto — no engine types leak into features; annotation affordances keyboard-complete.

**Blocked by:** None (parallel with T1).

**Status:** ready-for-agent (delta-grill: PDF range engine choice)

**Bound by:** FR-16, AD-13 (user-scoped), AD-2 (domain shape, one definition), AD-9 (never-color-only — underline/color paired with affordance labels).

- [ ] Annotate/remove on md + pdf fixtures; ranges stable across re-render
- [ ] Persistence round-trip (reload + second device shape)
- [ ] Engine decision recorded in `## Comments` (fidelity + bundle criteria)
