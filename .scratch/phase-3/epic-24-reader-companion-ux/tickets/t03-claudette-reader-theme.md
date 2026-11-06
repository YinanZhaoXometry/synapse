# T3 — Claudette reader theme + Settings toggle

Status: done
Epic: [epic-24](../epic.md) · Spec: [spec.md](../spec.md) §Q3

## Goal

The markdown reader can wear the Claudette Typora theme (MIT, CookPiu 2026):
ivory page, paper sheet, serif 400 headings, terracotta accent, hairline tables.
Default OFF; toggle in Settings.

## Changes

- `frontend/src/index.css`: `.reader-claudette` block — light tokens (:root
  values of claudette.css, in-container scope) + `.dark .reader-claudette`
  overrides (claudette-dark.css). Covers: container page tint, article paper
  card (radius 16 / hairline ring / shadow), headings (font-display serif, 400,
  h1 accent underline + lead paragraph, h2 hairline, h3 dot), blockquote clay
  line + “”, tables (separate borders, rounded, uppercase th, row hover),
  inline code accent-soft, pre ivory surface, hr ✳, links w/ soft underline,
  task-list checkboxes. Excludes `mark[data-annotation-id]` and the
  selection/flash/marking overlays (app tokens keep those).
- NEW `frontend/src/lib/reader-md-theme.ts`: `READER_MD_THEME_KEY =
  "synapse-reader-md-theme"`; `getReaderMdTheme()` / `setReaderMdTheme()`
  (lazy-write: only the setter persists) + `useReaderMdTheme()` hook (state +
  storage/custom-event sync — the toggle applies to an open reader).
- `frontend/src/features/reader/MarkdownFlow.tsx`: applies the class when on.
- `frontend/src/pages/SettingsPage.tsx` (+test): 阅读器 group row — Switch
  「Claudette 纸张主题」 with zh/en copy (`settings.readerTheme*` keys).

## AC

- Off = today's look in both modes; on = claudette light in light mode,
  claudette dark tokens in dark mode.
- Pref persists (reload keeps it); lazy-write (no key until first enable).
- Toggle flips an already-open reader (event sync test).
- Settings + hook tests green; tsc/eslint/vitest/build green.

## Close-out

Theme scoped to the markdown flow only (PDF/pptx keep the app look); the
settings row lands in the appearance section; attribution comment carries the
MIT provenance.
