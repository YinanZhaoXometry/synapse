# T6: Responsive ladder, theme verification, integration walk, gates (AD-9/10; UX responsive)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 05-companion-panel.md

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's closing pass: the reader + Companion working together at every width and in every theme, and the end-to-end walk that proves the seams hold. From the user's perspective: on a desktop the Companion docks beside the reading and collapses to a rail; on a tablet it becomes a toggleable overlay; on a phone the reading goes full-bleed with the Companion as a bottom sheet. Immersive mode clears the reader chrome. Everything holds in dark mode and all three palettes, respects reduced motion, and speaks both languages throughout. One integration test walks the whole story: attach → parse → open → position saved → grounded chat citing the position → reload simulation.

## Acceptance criteria

- [ ] ≥1024px: Companion docked right at 400px (420px ≥1280px), collapsible to a rail; 768–1023px: Companion toggles as a right overlay; <768px: full-bleed reading, Companion as bottom sheet (~65dvh, drag handle) (UX responsive ladder)
- [ ] Immersive toggle hides the reader top bar and collapses the panel (app sidebar chrome explicitly out of scope; reading stays primary)
- [ ] Reader + Companion verified in light + dark and sunset/twilight/aurora palettes; no raw palette classes or hardcoded whites — glass/accent-tint tokens only (DESIGN amendment 2026-11-02)
- [ ] Reduced-motion: streaming indicator, anchor flash, and sheet animation all collapse gracefully (a11y floor)
- [ ] i18n parity sweep over the new features: no hardcoded user-facing strings anywhere in reader/companion (NFR-5)
- [ ] Accessibility floor: Esc closes the topmost reader layer; 200% text zoom reflows; study/parse states never color-only
- [ ] Integration walk test: attach → parse → open reader → position saved → grounded chat citing the position → reload simulation (sections/progress/thread survive; bytes gone; re-upload contract intact) (prior art: evidence-loop.integration.test.ts)
- [ ] AD-8 guard: pdfjs-dist and react-markdown are imported only inside the reader feature — verified (lint rule or checked grep)
- [ ] Full gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched (MaterialsPage demo, Dashboard); FR-8/9/10/11/12 acceptance demonstrable end-to-end
