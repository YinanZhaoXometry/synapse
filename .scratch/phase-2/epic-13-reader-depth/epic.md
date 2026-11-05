# Epic 13 (Phase 2) — Reader depth: selection, Quick Test, Annotations, Study Focus, PPT

Status: done (2026-11-05 — all five tickets done + two-axis reviewed, merged to main; rspec 1233 / vitest 796; OQ-1 = reader-side panel; ranges = zero-dep char-offsets; FR-15 web-marking gap recorded for epic-14; PPT rides the markdown pipeline)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-13/14/16/17, FR-15 delta, PPT owner Q6 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.2) · spine **AD-7** (client-side rendering + the `parse(file)` public API), AD-5 (selection grounding contract), AD-9 (accessibility floor) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-selection-shortcuts.md](issues/01-selection-shortcuts.md) | — (epic gate) | selection bar: Ask Companion / Quick Test (FR-13) |
| 2 | [02-quick-test.md](issues/02-quick-test.md) | 1 | 3–5 q on selection/section → mistakes + evidence; FR-15 delta check (FR-14/15) |
| 3 | [03-annotations.md](issues/03-annotations.md) | — (parallel) | multi-color highlight + underline, persistent, removable (FR-16) |
| 4 | [04-study-focus.md](issues/04-study-focus.md) | 3 | annotation-derived core items, regenerable; placement per OQ-1 (FR-17) |
| 5 | [05-ppt-upload.md](issues/05-ppt-upload.md) | — (lane filler, no gate) | `.pptx` client-side parse → sections, same attach pipeline |

## Definition of done

Selection → both actions work on md + pdf fixtures · Quick Test writes mistakes + evidence · annotations persist user-scoped and survive reload · Study Focus regenerates · PPT uploads study like any Material · accessibility floor + bilingual/theme checks pass · gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epic-08 done** for T1–T4; **T5 (PPT) is the designated lane filler** — runnable any time after epic-00 (pure client-side parse extension), per the roadmap.
- T2 consumes epic-10-T5's targeting when available (optional input — degrade gracefully if 10 unfinished).
- T3 unblocks T4; T1/T3 parallel-friendly.

## Kickoff delta review — 2026-11-05 (decide-all delegation)

Recon @ `ebc1026`: `annotations` table = minimal (user/material FKs + `locator` jsonb + `body` text — no kind/color/range yet); no annotation GraphQL ops exist; reader = MarkdownFlow (react-markdown, lazy) + PdfPageFlow (pdfjs-dist 6, text layer); epic-12 landed `plan_companion`; generateQuiz scopes are plan|task|targeting.node (xor).

1. **OQ-1 (Study Focus placement) = reader-side panel on demand** (the recommendation): a collapsible 「核心要点」panel toggled from the reader toolbar; items generated from the material's annotations through the AD-16 seam (cap-counted, sync command like generateNote); regeneration REPLACES (v1 marker on the row); items deep-link via the anchors channel.
2. **PDF annotation range engine = zero-dep char-offset ranges** (fidelity: pdf.js text layers are deterministic per page — char offsets survive re-render; markdown ranges = sectionId + char offsets within the section's stable text; rendering: CSS Custom Highlight API where available, wrapped-span fallback; bundle: zero new deps beats annotation libraries — criteria recorded).
3. **Annotation schema extension:** migration adds `kind` (string, default "highlight", CHECK highlight|underline), `color` (nullable string — named palette keys), `range` (jsonb nullable — the AD-2 domain range `{ sectionId? | page?, start, end, quote }`: char offsets + the quoted text for drift verification). `body` stays the free-text note (empty for pure highlights). GraphQL ops: `annotations(materialId:)` user-scoped query + `addAnnotation` / `removeAnnotation` mutations (all verb-first/closed-enum/NOT_FOUND conventions).
4. **Quick Test scope honesty (AD-6):** evidence records belong to NODES, so a section/selection Quick Test generates evidence only when the material has ≥1 CONFIRMED node mapping — the entry point gates on that (hides with a traceable hint when unmapped; trace-to-gap per FR-27's spirit). `GenerateQuizInput` gains optional `materialId` + `sectionIds: [String!]` (xor grows: planId | taskId | targeting.nodeId | materialId; with materialId, sectionIds optionally narrows to 1..5 sections; attribution maps to the section's mapped node — sections without a mapping don't contribute questions). Questions count 3-5 (a QUESTION_TARGET override input or a fixed quick constant — pin: `targetCount` optional Int 3..5, default 5).
