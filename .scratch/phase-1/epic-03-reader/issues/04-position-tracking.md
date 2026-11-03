# T4: Reading Position tracking + continue-reading wiring (FR-10; FR-25)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 03-reader-markdown.md

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

Reading Position, end to end. From the user's perspective: as they read, the system quietly knows where they are — the most-visible PDF page, the scroll-spy'd Markdown section — and remembers it per material across sessions. Reopening a material puts them back where they stopped (deep-link anchors still win when present). The plan surfaces then speak the truth: Plan Home material rows say 继续阅读 when progress exists, and the Plans Home continue hero shows the 「上次读到 …」 line — closing the deferral epic-2 explicitly left for this slice.

The position's `text` is the bounded extracted section/page text from `Material.sections` — never raw bytes — so what the tracker persists is exactly what the Companion (T5) and later quiz generation will ground on.

## Acceptance criteria

- [x] PDF: the most-visible page is the current Reading Position (visibility-based tracking per the UX spine); Markdown: scroll-spy over section boundaries (FR-10; AD-2 domain type consumed verbatim)
- [x] `ReadingPosition { locator, text }` — text is the bounded section/page text from `Material.sections`; no raw bytes, no unbounded text (AD-4 quota safety)
- [x] Persisted debounced (on position change) and on unmount through the existing ReadingProgress repository / query hooks — no new persistence shape (AD-3; AD-10 dense-behavior testing)
- [x] Restore on open: stored page/section restores automatically; `?page=N` / `#section-id` anchor params win over stored progress when present
- [x] Plan Home material rows show 继续阅读 vs 打开 based on stored progress (FR-25 continue-reading entry points)
- [x] Plans Home continue hero carries the 「上次读到 …」 line (material + page/section) from the most recent ReadingProgress across plans — epic-2's deferral closes here (FR-25)
- [x] Tracker selectors are pure functions with vitest coverage: most-visible-page from measured page rects (incl. half-visible boundaries), scroll-spy boundary cases (prior art: display-shaping tests)
- [x] ReadingProgress round-trip + reload simulation: position survives reload; sections it points at survive (AD-4)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5); semantic tokens only (AD-9)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched
