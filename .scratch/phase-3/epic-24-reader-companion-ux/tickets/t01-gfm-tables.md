# T1 — GFM tables: remark-gfm in renderer + sectioner, default table prose

Status: done
Epic: [epic-24](../epic.md) · Spec: [spec.md](../spec.md) §Q1

## Goal

Pipe tables (and GFM strikethrough / task lists / autolinks) render in the
markdown reader; the sectioner/render pipeline parity invariant holds.

## Changes

- `frontend/package.json`: `remark-gfm@^4` (pnpm).
- `frontend/src/features/reader/markdown-view.tsx`: `remarkPlugins={[remarkGfm]}`.
- `frontend/src/features/reader/parse-markdown.ts`: `.use(remarkGfm)` in
  `loadProcessor()` — the mirrored pipeline.
- `frontend/src/index.css`: `.reader-prose table/thead/th/td` defaults on
  semantic tokens (collapse, hairline rows, muted uppercase-less header weight,
  row padding, overflow wrapper not needed at 70ch).

## AC

- Anchor agreement + parse-markdown suites green unchanged (ids/offsets stable).
- New markdown-flow test: a pipe-table document renders a real `<table>` with
  th/td; `~~x~~` strikethrough renders `<del>`.
- tsc / eslint / vitest green.

## Close-out

remark-gfm wired both sides; prose table defaults added; agreement +
anchor tests byte-green. Committed on the epic branch.
