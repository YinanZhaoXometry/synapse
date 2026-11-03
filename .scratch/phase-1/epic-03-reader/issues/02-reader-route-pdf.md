# T2: Reader route — PDF page flow, anchors, parse-state UIs (FR-8; AD-8)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-parse-api.md

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The Immersive Reader's route and its PDF branch. From the user's perspective: clicking a plan's material row opens `/read/:materialId` in-app; a parsed PDF renders as a continuous vertical page flow sized to fit-width, with `←`/`→` stepping between pages and a page pager in the top bar. Deep links land precisely: `?page=N` scrolls to that page, and the transient `?hl=1` flag briefly flashes the target in the citation tint. A material still parsing shows a page-skeleton with progress copy; a failed parse shows a card with the reason and a retry; a parsed material whose bytes were lost to a reload shows the re-upload affordance and renders again once re-uploaded. Reading stays sacred: maximal area, minimal chrome, the PDF page container carrying the app's one large shadow.

The Companion panel arrives in T5 — this ticket leaves an honest placeholder (or nothing) on the right, not a stub that pretends.

## Acceptance criteria

- [x] `/read/:materialId` exists, lazy-loaded under AppLayout; unknown/missing material shows an honest not-found state (AD-8)
- [x] Parsed PDF renders page-by-page as fit-width canvases; pages lazily render near the viewport and far pages release; continuous scroll, not a single-page pager (FR-8; UX spine "page follows scroll")
- [x] Top bar: back link, material title, page pager (第 N / 共 M 页), panel-collapse and immersive toggles per the mock (spine wins where the mock is stale); reader typography posture (reading is sacred, one large shadow on the page container)
- [x] `←`/`→` steps to the previous/next page (UX interaction primitive)
- [x] Anchors: `?page=N` scrolls to page N; `?hl=1` flashes the target briefly (citation tint), flag is transient (AD-8; UX citation-chip behavior)
- [x] Parse states in the reader: parsing → page-skeleton + progress copy; failed → card with bilingual reason + retry (retry works while bytes exist); companion side shows waiting/disabled copy or nothing — never a chat that pretends (UX reader states)
- [x] Parsed-but-byteless material (post-reload): inline re-upload affordance; after re-upload, pages render (FR-29 relaxed; epic-2 re-upload contract)
- [x] Plan Home material rows gain an open action into the reader (continue-reading labels are T4's — a plain open action is enough here)
- [x] Anchor-param parsing and pager math are pure functions with vitest coverage (canvas rendering itself is not component-tested — jsdom cannot render canvases)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5); semantic tokens only — verified in dark mode (AD-9)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched
