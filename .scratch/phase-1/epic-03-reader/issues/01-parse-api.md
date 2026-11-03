# T1: parse(file) API — reader extraction + eager parse at attach (AD-7, FR-8/9 groundwork)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: none (can start immediately)

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The reader feature's public `parse(file)` extraction API and its wiring into the attach flow. From the user's perspective: after attaching a material on Plan Home, the pending-parse chip progresses to "parsing" and then to "parsed" (or to an honest failed state with a bilingual reason and a retry action while the file bytes still exist). Extracted per-section text persists, so after a reload the material still carries its content even though the file bytes are gone — the existing re-upload contract stays unchanged. This ticket ships **no reader UI** (the route is the next ticket); verifiability is through Plan Home material rows and the data layer.

Design constraints: pdfjs-dist is dynamically imported **only inside the reader feature** (AD-8); parse output is the existing `MaterialSection[]` shape (`page-N` ids for PDF, github-slugger slugs for Markdown), text bounded by the existing per-section cap (AD-4); the parse state machine drives the already-declared `pending → parsing → parsed | failed`.

## Acceptance criteria

- [x] The reader feature exposes `parse(file)` as its public surface: file bytes + kind in; `{ sections, state: "parsed" | "failed", reason? }` out (AD-7; AD-2)
- [x] PDF parsing: per-page text extraction → sections with `page-N` ids, title from the page's first heading-like line (fallback 「第 N 页 / Page N」); pdfjs-dist dynamically imported only inside the reader feature (FR-8 groundwork; AD-8)
- [x] Markdown parsing: pure sectioner splitting on ATX headings (code fences never read as headings), slugs via github-slugger matching rehype-slug, duplicate headings dedupe (`-1`, `-2`), CJK headings stable (FR-9 groundwork)
- [x] Per-section text bounded by the existing 2000-char cap; no raw bytes ever persisted (AD-4)
- [x] Parse state machine `pending → parsing → parsed | failed` with reason codes (corrupt / encrypted / empty / unknown) mapped to bilingual copy; retry re-runs from the session blob (only while bytes exist)
- [x] Eager parse: the plans attach flow calls the reader's `parse()` right after `registerMaterial`; results write back through a new material-repository mutation; TanStack Query invalidation refreshes the rows (AD-3; AD-7 "callable from plan/task upload flows")
- [x] After reload: metadata + sections + parseState survive; bytes gone; rows show the known re-upload contract (AD-4; FR-29 relaxed)
- [x] Parse failure keeps metadata + failed state; the row shows a failed chip + retry while bytes exist — never silent, never a fake success
- [x] Tests: a minimal committed fixture PDF exercised via pdfjs's legacy build with the fake worker in vitest; fixture Markdown incl. CJK headings + duplicate-heading dedupe; state-machine transitions incl. retry; repo write-back + reload simulation (prior art: upload-validation / material-repository / entry-decision tests)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5); semantic tokens only (AD-9)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched
