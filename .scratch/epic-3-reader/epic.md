# Epic 3 — Immersive Reader + page-aware Companion (FR-8 · FR-9 · FR-10 · FR-11 · FR-12)

Status: done
Milestone: Phase 1 — Nov 6 core

## Parent

Spec: [spec.md](spec.md) (grill round closed 2026-11-03, all recommendations adopted under the standing delegation). Bound by the architecture spine (AD-2/3/4/5/7/8/9/10; FR-33\* frontnote — simulated AI in Phase 1), ADR-0001, the UX spines (DESIGN/EXPERIENCE), GLOSSARY.md, and the PRD Phase-1 slice.

## Scope note (slices 3+4 merged)

The phase-1 slicing table splits reader (slice 3, FR-8/9/10) from companion (slice 4, FR-11/12) because epic-4 blocked on epic-3's ReadingPosition. They ship as **one epic with one spec chain**: the Companion is a thin consumer of the reader's position feed, the two are demo-locked (SM-2 requires grounded answers beside the reading), and the Nov-6 deadline still has slices 5/6/7 after this. `features/reader` and `features/companion` remain two separate features with the AD-2 public surfaces — only the delivery bookkeeping is merged.

## What to build

`features/reader`: the public `parse(file)` extraction API (AD-7) — eager at attach time, driving `pending → parsing → parsed | failed` with retry; the `/read/:materialId` route with AD-8 anchors (`?page=N` / `#section-id` + `?hl=1`); PDF page-by-page canvas rendering (pdfjs-dist 6.x, dynamically imported inside the feature only) and Markdown rendering (react-markdown 10 + rehype-slug 6) in the reader typography role; visibility-tracked ReadingPosition persisted through the existing ReadingProgress repository; continue-reading entry points (Plan Home rows + Plans Home continue line, closing epic-2's deferral).

`features/companion`: page-aware `CompanionPanel` on the scaffold chat surface pattern, calling the existing `CompanionService.chat` with the current ReadingPosition; guardrail ladder rendering (intent/rung/canEscalate + quiet EscalationControl, via a backward-compatible `escalated?` flag on `GroundedChatRequest`); CitationChips that jump the reader to source via the AD-8 anchor channel; honest ungroundable fallback; streaming, error/timeout retry; ChatThread persistence via the existing repositories. Companion disabled for un-parsed materials — never chats against a document it can't see.

UI reference: `docs/design/ux-synapse/mockups/key-reader-companion.html` (stale sidebar chrome — spine wins on conflict).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-parse-api.md](issues/01-parse-api.md) | — | reader `parse(file)` API + parse-state machine + repo seam + eager parse wired into plans attach (AD-7) |
| 2 | [02-reader-route-pdf.md](issues/02-reader-route-pdf.md) | 1 | `/read/:materialId` route, PDF page flow, anchors, parse-state UIs (FR-8; AD-8) |
| 3 | [03-reader-markdown.md](issues/03-reader-markdown.md) | 2 | Markdown rendering + section addressing + scroll-spy (FR-9) |
| 4 | [04-position-tracking.md](issues/04-position-tracking.md) | 2 | ReadingPosition tracker + persistence + continue-reading wiring (FR-10; FR-25) |
| 5 | [05-companion-panel.md](issues/05-companion-panel.md) | 4 | page-aware CompanionPanel, guardrail ladder, CitationChips, thread persistence (FR-11/12; AD-5) |
| 6 | [06-polish-gates.md](issues/06-polish-gates.md) | 5 | responsive (dock/overlay/bottom sheet), i18n parity, dark-mode + palette pass, integration walk, gates |

## Definition of done

FR-8/9/10/11/12 acceptance · SM-2 satisfiable in a live demo by the simulated adapter (three consecutive answers visibly citing their source location) · gates green (`npx tsc -b`, `npm run lint`, `npm run test`) · grandfathered scaffold surfaces untouched (MaterialsPage stays demo; Dashboard untouched) · every ticket cites its AD ids (`docs/agents/workflow.md`) · reader/companion UI verified in light + dark and sunset/twilight/aurora.

## Closure (2026-11-03)

Shipped T1–T6 (`5e44386` → `65b244c`) + review-fix pass (`e720d82`). Two-axis review (spec-conformance + defects): **0 × P0, 3 × P1, 8 × P2 — all fixed** in `e720d82` (markdown short-doc never reported a position → Companion permanently disabled; canvas far-page release kept the backing store; citation chips not rendered mid-stream; pdfjs parse loadingTask leak; untracked landing-flash timers; silent persistence failures; deletePlan cascade; empty-heading id guard; reader public surface via `features/reader/index.ts`; scroll-mt alignment). **Deferred follow-ups** (deliberate, non-blocking): per-frame `measureBoundaries` caching (perf nit on very long docs); sheet/overlay unmount abandons an in-flight turn by design (candidate for persist-on-send); hook state reset on in-place `materialId` change (unreachable today); `text-white` on the brand gradient (grandfathered scaffold pattern). 236/236 tests, tsc/eslint/build clean; pdfjs 558 kB + markdown-view 31 kB + reader route 37 kB all lazy, out of the main bundle (AD-8 verified by grep).
