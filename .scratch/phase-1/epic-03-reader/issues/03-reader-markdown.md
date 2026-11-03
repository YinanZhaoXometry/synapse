# T3: Reader Markdown branch — rendered sections, addressable anchors (FR-9)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-reader-route-pdf.md

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The Markdown branch of the same reader surface. From the user's perspective: opening an attached Markdown material renders it as a well-set document — headings hierarchical, body in the reader typography role — and every section is addressable: `#section-id` deep links scroll to the section, and the section boundaries line up exactly with the text the Companion will ground on (T1's sectioner and the rendered anchors agree). The parse/failed/re-upload states work identically to the PDF branch.

## Acceptance criteria

- [x] Markdown materials render with react-markdown + rehype-slug inside the reader feature; hierarchical headings with stable section ids that match T1's sectioner slugs (FR-9; AD-7)
- [x] Rendered in the reader typography role: `reader-body` 17px, line-height 1.75 Latin / 1.9 CJK, measure 70ch per DESIGN; PDFs unaffected (MD renders as authored structure, not restyled)
- [x] `#section-id` anchors scroll to the section; `?hl=1` flashes it briefly (citation tint) — same anchor channel as the PDF branch (AD-8)
- [x] Section boundaries are exposed to the app (measured heading positions) for the position tracker to consume in T4 — grounding text and rendered anchors come from the same source
- [x] Parsing / failed / re-upload states work identically to the PDF branch (shared reader state UIs)
- [x] Sectioner ↔ rendered-anchor agreement test: on fixtures (incl. CJK + duplicate headings), parsed section ids equal the rendered heading ids
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5); semantic tokens only — verified in dark mode (AD-9)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched
