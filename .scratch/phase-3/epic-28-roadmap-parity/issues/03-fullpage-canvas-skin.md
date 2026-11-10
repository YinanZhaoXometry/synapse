# 03: Full-page canvas + verbatim skin — the roadmap leaves the widget (FR-5 rendering)

**What to build:** the plan graph becomes a full-page, scroll-down-only spine rendered in roadmap.sh's exact measured skin. The bounded pan/zoom widget dies. After this ticket the reading experience IS roadmap.sh's (plus our state layer); chips/sheet upgrades land in T4.

**Blocked by:** 01 (studyMark on the wire), 02 (spine layout).

**Status:** done (2026-11-11)

**Bound by:** FR-5; owner decisions 2026-11-11 (full-page scroll, no zoom/pan, verbatim style copy, dual-mode colors, spine layout, List toggle stays); AD-9 (keyboard floor — roving tabindex preserved, not rebuilt); AD-14 (progress reads server states only); NFR-6 (one new asset total: the OFL font); theme discipline (tokens only, zero raw hex in components).

- [ ] Canvas posture: SVG inline in the plan page document flow (nodes zone); width = container width, scale = container/layout width via ResizeObserver, height follows the layout aspect; page scroll is the only navigation; no horizontal overflow by construction
- [ ] Deleted with their tests: zoom buttons, wheel listener, pointer-drag pan, two-finger pinch, Safari gesture guards, fit-view, translate-based pan-into-view (epic-20 canvas posture + epic-16 zoom posture retire; git history is the archive)
- [ ] `?node=` deep link + keyboard focus-into-view → native `scrollIntoView` (block: nearest); deep-link opens the sheet as before (mount-only latched semantics preserved)
- [ ] Skin tokens in index.css (copied values as defaults in BOTH light and dark; only the canvas background follows theme tokens): `--roadmap-hub-face:#fdff00`, `--roadmap-leaf-face:#ffe599`, `--roadmap-edge:#2b78e4`, `--roadmap-node-border` black/2.7, corner radius 5, fan dasharray `0.8 8`, edge width 3.5, node text 28px; components reference tokens only — no raw hex anywhere
- [ ] Balsamiq Sans self-hosted (woff2 + OFL LICENSE in frontend/public/fonts/), @font-face scoped to the roadmap canvas via `--roadmap-font`; global fonts untouched
- [ ] Node vocabulary: hub cards = spine-styled, NOT interactive (no cursor, no chips, no sheet — keep the per-stage mastered/total count); leaves = copied leaf skin; optional nodes keep dashed border; titles truncate ~18 chars (full title in sheet/chips)
- [ ] Dual corner badges on leaves: Study Mark chip top-right (学习中=blue / 已完成=green / 已跳过=gray, from `studyMark`, glyph+aria-label — not color-only) + mastery glyph bottom-left (✦/◐/○ unchanged vocabulary); node fill never encodes mastery (NODE_STATE_FACE retires from the graph; list view untouched)
- [ ] Progress header: bar stays mastered/total off server states (AD-14) + new small line counting marks (已标记完成 X · 学习中 Y · 已跳过 Z); legend reworked badge-style (mark colors + mastery glyphs); all new strings are zh/en dotted keys (parity test enforces)
- [ ] Keyboard: roving tabindex over leaves in reading order (stage by stage, left fan before right fan); Up/Down = prev/next reading order; Left/Right = same-row opposite-side leaf; hubs not tab stops; Enter opens sheet; Esc closes; focused node kept scroll-visible
- [ ] Tests: pan/zoom/pinch/wheel/fit assertion blocks deleted; new pins for scale computation (ResizeObserver stub), scrollIntoView calls, dual badges (presence/aria/mark colors), hub non-interactivity, edge classing (solid/dotted by class), legend + mark-count line, deep-link scroll+sheet, keyboard contract carry-over; every surviving aria/behavior assertion from the old suite kept
- [ ] web gates green (tsc/eslint/vitest --coverage/build + codegen freshness)

## Comments

- (none yet)
