# 03: Tab buttons + sidebar-tree polish + roadmap scale + tooltip + ⌘K

**What to build:** The owner's first live-testing feedback round on PR #29 + epic-28 roadmap-parity, four scoped batches (owner answered two grill questions: tab scope = buttons only, tree style = align to main nav):

1. **Plans Home tab buttons** (`PlansHomePage.tsx` ~:104-121): the 我的计划/广场 pill pair → the sidebar-row vocabulary (h-9 rounded-lg px-4 text-sm font-medium; active `bg-[var(--glass-4)] text-foreground shadow-soft`, inactive muted + hover glass-2). Card grids stay. role/aria/testid unchanged.
2. **SidebarPlanTree aligns to main nav**: rows 13px→14px (`text-sm`); mastery chip loses its bg → pure `text-accent-ink` number (11px semibold tabular-nums); section heading 9px-uppercase → `text-xs font-medium text-muted-foreground`; view-all row text-muted-foreground.
3. **Roadmap scale + tooltip** (roadmap-spine-layout.ts + RoadmapGraph.tsx + PlanHomePage.tsx + index.css): NODE_W 297→310, NODE_H 51→62, ROW_PITCH 57.5→78, FAN_GAP 122→100, BLOCK_GAP 40→56, PADDING 28→30, HUB_SECOND_LINE 33→40, HUB_LINE_PX W−44; right rail 340/400→320/368 (ADAPTED from plan's 300/352 — 4da79d3 moved materials+notes into the rail, a harder squeeze there would cramp them); rects rx 5→10 (focus ring 9→13); titles 28→30, glyph 22→24, hub progress 13→14, text insets + budgets + width meters (CJK 28→30, latin 14.5→15.5) follow. Chip strip: wrapper anchored at node top-center, strip `absolute bottom-2 left-1/2 -translate-x-1/2` — structurally always above + centered, never covers the node; horizontal clamp via measured half-width; bg → new `--popover-glass` token (light rgba(255,253,250,.86) / dark rgba(30,26,34,.86)) + backdrop-blur (token REQUIRED — skin guard bans raw rgba/hex in RoadmapGraph.tsx). Timing/content unchanged.
4. **⌘K interception** (CommandPalette.tsx): keydown → capture phase + preventDefault + stopPropagation; keyup capture listener preventDefault-only. Honest limit recorded: browser-level shortcuts (Arc command bar, extension bindings) are consumed before the page — unblockable; renderer-level defaults are now blocked.

**Blocked by:** None. Code-disjoint from epics 29-32 (touches PlansHomePage tab block, SidebarPlanTree, spine layout/graph constants + chip strip, CommandPalette keydown).

**Status:** done — shipped in PR #30 @ `1c61b01` (2026-11-11). All four batches landed; rail widths adapted 300/352 → 320/368 (4da79d3 had moved materials+notes into the rail — recorded as the ticket's one assumption). Owner manual checklist pending: ⌘K in the real browser (browser-level bindings stay unblockable).

- [ ] Tab buttons render in the row vocabulary; pill classes gone from the two buttons; grid/card rendering untouched
- [ ] Tree rows 14px, chip = bare accent number, heading = small regular label; AppLayout fixed links untouched
- [ ] Spine constants match the table above; SPINE_WIDTH stays ≈1190; rx=10 on both rect kinds; new font sizes + meters in place; hub second-line math rides SPINE_HUB_SECOND_LINE
- [ ] Chip strip: positioned above + centered structurally (no top clamp anywhere), translucent token bg + blur, timing tests untouched; skin guard green
- [ ] spine-layout.test 51-literals re-pinned; RoadmapGraph.test height/rx assertions updated + NEW tooltip position assertions (wrapper top = node top edge; strip above wrapper)
- [ ] CommandPalette ⌘K test: capture-phase intercepts (defaultPrevented), keyup doesn't toggle
- [ ] Gates green: codegen, tsc -b, eslint, vitest --coverage, vite build; dark-mode sanity for glass token
