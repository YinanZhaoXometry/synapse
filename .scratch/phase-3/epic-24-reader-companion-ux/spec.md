# Epic 24 spec — reader-companion-ux

Delta-grill at kickoff (self-answered per the standing decide-all delegation,
2026-11-06). Four owner-reported items; each worked through the four standard
questions. Prior art: epic-20 touch-batch (small owner-named batch, spec at
kickoff, serial tickets).

## Q1 — Markdown tables（→ T1）

**What breaks:** the reader renders with `react-markdown` + `rehype-slug` only —
CommonMark. GFM pipe tables (and strikethrough/task lists/autolinks) parse as
plain paragraphs. `.reader-prose` has no table rules at all (nothing ever
rendered one).

**Fix:** `remark-gfm@^4` (unified-11 compatible, matches react-markdown 10) in
the renderer AND in the sectioner's `loadProcessor()` — the sectioner mirrors
the render pipeline BY CONSTRUCTION (parse-markdown.ts header contract), and
`markdown-anchor-agreement.test.tsx` enforces it. Heading parsing is untouched
by GFM, so ids/offsets are stable. Plus default `.reader-prose` table styles on
semantic tokens (hairline rows, clean header) for the non-theme look.

**Rejected:** swapping renderers (marked/markdown-it) — the anchor invariant is
built on the react-markdown pipeline; a renderer swap would re-derive every
section id. Compatibility ask is satisfied by GFM, the GitHub-standard dialect.

**AC:** pipe table renders as `<table>`; heading anchors + section slicing
byte-identical pre/post (agreement tests green); strikethrough/task-list
sanity-checked in tests; tsc/vitest green.

## Q2 — 标注移除（→ T2）

**Interaction:** hover a painted annotation (markdown article only — PDF parked)
→ a small popover near the range: note body when present (muted), a trash
button 「移除标注」. Click → ReaderPage's existing `handleRemoveAnnotation` →
mutation → cache update → engine re-applies → mark gone. Dismiss: leave the
range/popover, scroll, Escape, or a click outside. Heading marking controls
(claim/confirm-quiz) keep their click surfaces — the popover never covers them
(spawn offset above/below the range rect).

**Mechanics per engine path:** fallback path — delegation on
`mark[data-annotation-id]` (the only path jsdom runs → tests exercise it).
Highlight-API path (all real browsers) — caret hit-test:
`caretRangeFromPoint`/`caretPositionFromPoint` → text node → its section region
→ accumulated offset → covering annotation. Stale/missing ranges are NOT
hoverable (they don't paint; the list panel keeps their honest rows).

**AC:** hover a fallback mark → popover with body + remove; click remove →
callback with the right id; popover hides on leave/scroll/Escape; Highlight-path
offset math unit-tested via the exported resolver (the caret bridge itself is
browser-only, covered by the live smoke).

## Q3 — Claudette 主题（→ T3）

**License:** MIT (CookPiu 2026) — port allowed with attribution. We port the
token VALUES + the editorial rules (serif headings w/400, h1 accent underline,
h2 hairline, h3 dot, blockquote quote-mark, hairline table w/ uppercase th,
inline-code accent-soft, hr ✳, paper sheet on ivory page) — NOT Typora's
selector machinery (`#write`, CodeMirror, sidebar…). Annotation marks keep
their own palette (`mark[data-annotation-id]` excluded from the theme's mark
rule); selection/flash/marking overlays keep app tokens.

**Scope:** `.reader-claudette` on MarkdownFlow's scroll container; CSS in
index.css (light tokens default, `.dark` overrides from claudette-dark.css).
Settings gets a 阅读器 group: switch 「Claudette 纸张主题」, default off,
persisted at `synapse-reader-md-theme` (= "claudette" when on), lazy-written in
the setter (the four UI keys' convention). MarkdownFlow reads it per mount +
listens for changes (storage event + a local custom event so the toggle applies
to the open reader live).

**AC:** toggle off → today's look (both modes); on → ivory page + paper card +
claudette typography in light AND dark; pref survives reload; toggle applies to
an already-open reader; Settings test covers the new row.

## Q4 — Companion 快捷交互（→ T4）

**Always-visible chips:** reading surface renders the starters whenever the
material can chat (not only `entries.length === 0`); plan surface always.
Disabled while `busy` or the surface's gate says no (reading: position not
ready / parse failed). No new keys — the same chips.

**考考我 → real question:** the reply text ends with exactly one fenced
` ```synapse-quiz ` block:

- choice: `{"kind":"choice","question":"…","options":["…"×3–4],"answer":<index>,"explanation":"…"}`
- short: `{"kind":"short","question":"…","answerText":"…","explanation":"…"}`

Rendering (new `QuizBlock` inside CompanionBubble): choice = option buttons,
single-select, submit enabled once selected; short = auto-grow-ish textarea +
submit. After submit the block locks and shows verdict (正确 / 再想想), the
correct answer, and the explanation. NFR-8: NOTHING about the answer renders
pre-submit. `message-shaping.splitQuizBlock()` is the pure parser (validated —
malformed fence → whole text renders raw, honest degradation). Streaming hides
the fence tail (lead text + 出题中 line). Persistence rides the text; restored
threads rehydrate the block (fresh answer state).

**Simulated double:** quiz-me now emits a deterministic fence derived from the
grounding text (cloze-choice from a salient term when the page offers one;
short "explain this" otherwise), still cited. **GLM:** the companion +
plan_companion prompts gain the quiz-me instruction (materials-sourced, language-
matched, answer never outside the block); prompt specs assert it. **Wire:**
byte-unchanged (D4) — no stream contract, schema, or stub-provider change; e2e
keeps companion AI-gated surfaces uncovered.

**AC:** chips visible after turns; quiz-me chip → interactive block (choice and
short paths tested with userEvent); verdict/correct/explanation only post-submit;
reload replays the block; simulated reply fence parses; backend prompt specs
green; rspec/rubocop green.
