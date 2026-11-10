# 02: ⌘K entity search (plans · materials · tasks)

**What to build:** The command palette grows from page-nav + language toggle into entity search: typing matches the user's plans (`usePlansQuery`), materials (`useAllMaterialsQuery`), and tasks (`query Tasks` via the typed hooks layer), grouped by type under the existing page-nav group. Data posture (epic Q3): cache-first off the same cache the hub pages already populate — opening the palette never blocks on the network; a background refetch on open is allowed. Selecting a plan → `/plan/:id`, material → `/read/:materialId`, task → `/task/:id`. With an empty query the palette shows the existing groups plus a 最近计划 section (top 5) — the fastest path to yesterday's session. DeepTutor's template: the palette "reads the same sources as the sidebar shelves … so opening it costs no extra round trip" (`CommandPalette.tsx:37-41`).

**Blocked by:** None (independent of T01; either order or parallel worktrees).

**Status:** done — shipped in PR #29 @ `bcf39ea` (2026-11-11). Filtering manual (`shouldFilter=false` passthrough on `CommandDialog`), caps at 8/group with count hints; jsdom `scrollIntoView` stub added to setup.ts.

- [ ] Palette results include plans / materials / tasks as cmdk groups alongside (not replacing) page nav + language toggle
- [ ] Cache-first: opens instantly from cache; background refetch on open only; no loading state ever blocks input
- [ ] Empty query shows page-nav + language groups + 最近计划 (top 5); typing filters entities client-side
- [ ] Routes: plan → `/plan/:id`, material → `/read/:materialId`, task → `/task/:id`
- [ ] Large lists don't lag: client-side cap per group (e.g. top 8 matches) with count hint — no virtualization needed at this scale
- [ ] i18n: group headings + empty states zh/en in `i18n-dictionary.ts` (full-parity test green)
- [ ] Tests: userEvent — open palette, type, keyboard-navigate (arrow keys + enter), entity selection routes correctly; language toggle behavior unchanged
- [ ] Gates green: codegen, tsc -b, eslint, vitest --coverage, vite build
