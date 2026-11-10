# Epic 24 — reader-companion-ux

Status: MERGED (PR #21 @ b5ce323 — status line was stale; closed 2026-11-10 board sweep)
Branch: `epic/p3-24-reader-companion-ux`
Milestone: Phase 3 — optimization season

## Scope (owner-reported, 4 items)

The owner hit four concrete gaps while demo-testing the Study Task page (reading
companion + markdown reader). All are UX-quality work on shipped Phase-2 surfaces —
no new PRD scope.

1. **Markdown 兼容渲染（T1）** — pipe tables render as plain text: the reader
   pipeline (react-markdown + rehype-slug) never had GFM. Add `remark-gfm` to the
   renderer AND the sectioner (pipeline parity is the anchor-agreement invariant),
   plus default table prose styles.
2. **标注悬停移除（T2）** — highlights were creatable but removable only through
   the annotations list panel. Hover a painted annotation → popover with the note
   body + 移除标注 → the existing `removeAnnotation` mutation.
3. **Claudette 阅读主题（T3）** — port the MIT-licensed Typora theme
   `claudette` (light + dark tokens) as a reader-content-only theme, toggled in
   Settings, default OFF.
4. **Companion 快捷交互（T4）** — the intent chips vanished after the first
   message (owner: 始终都显示), and 考考我 never produced an actual question —
   it streamed Socratic prose. Now: chips always visible (disabled while busy),
   and a quiz request ends in an interactive `synapse-quiz` block (choice =
   select + submit; short = textarea + submit; verdict + correct answer +
   explanation after submit; NFR-8: nothing reveals pre-submit).

## Decisions

- D1 (T1): `remark-gfm` in BOTH `markdown-view.tsx` and `parse-markdown.ts`
  `loadProcessor()` — the sectioner mirrors the render pipeline exactly
  (anchor-agreement tests stay the guard). GFM does not alter heading parsing,
  so section ids/offsets are unchanged.
- D2 (T2): hover popover, not click-through: the heading marking controls own
  click-on-heading; a hover popover cannot collide with them. Both engine paths
  are targetable — the wrapped-`<mark>` fallback by event delegation, the CSS
  Custom Highlight API path by caret hit-testing (caretRangeFromPoint /
  caretPositionFromPoint → text offset → covering range). PDF hit-testing is
  parked (owner asked for markdown explicitly).
- D3 (T3): the theme scopes to the markdown reader content only (the flow's
  scroll container + article) — never the app shell; the app's own theme system
  is untouched. Dark mode uses claudette's own dark tokens (the theme ships
  them), so both app modes read correctly. License: MIT (attribution comment in
  the CSS block).
- D4 (T4): the quiz rides the reply TEXT as one fenced ```synapse-quiz JSON
  block — the SSE wire contract stays frozen (no terminal/rung/schema changes),
  persistence rides the existing ChatThread text (restore re-parses the fence —
  the interactive block rehydrates after reload), and both the simulated double
  and the GLM prompts (companion + plan_companion) speak the same format. A
  malformed fence degrades honestly to the plain-text bubble.
- D5 (T4): chips render whenever their surface can chat (reading: material
  parsed; plan: always), disabled while a turn is in flight or the surface is
  otherwise gated — visible, never dead-looking-busy.

## Tickets

| # | Ticket | State |
| --- | --- | --- |
| T1 | [gfm-tables](tickets/t01-gfm-tables.md) | done |
| T2 | [annotation-hover-remove](tickets/t02-annotation-hover-remove.md) | done |
| T3 | [claudette-reader-theme](tickets/t03-claudette-reader-theme.md) | done |
| T4 | [companion-quiz-block](tickets/t04-companion-quiz-block.md) | done |

## Close-out

Landed on `epic/p3-24-reader-companion-ux`, 4 tickets, gates green
(tsc · eslint · vitest 963 · vite build · rubocop · rspec 1461).
Merge note: branch cuts from main @ ec4d552 — the owner's uncommitted
UserMenu/Settings demo batch (main checkout) touches SettingsPage(.test).tsx +
i18n-dictionary.ts, which T3/T4 also touch; commit that batch first, then merge
this branch and expect (small, mechanical) conflicts in exactly those files.
