# 03: Mastery-driven node states + click-through (FR-6/7)

**What to build:** node components (tree + graph nodes) render score states — mastered threshold green, partial below, uncovered distinct — **never color-only** (label/icon per accessibility floor); states update live as evidence mutations land (Apollo cache); click-through: mapped section → reader at the anchor (`?page=`/`#id`); no mapping or user opts → node Quick Test launch.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-6/7, AD-14 (server scores only — client never recomputes), AD-8 (anchor channel is the only reader command), AD-9 (never-color-only, keyboard-complete).

- [ ] State vocabulary matches EXPERIENCE's uncovered/partial/mastered terms; not color-only
- [ ] Live update after a quiz's evidence lands (no refetch of the whole plan)
- [ ] Click-through lands reader at mapped section or launches node Quick Test
