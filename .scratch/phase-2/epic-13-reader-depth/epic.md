# Epic 13 (Phase 2) — Reader depth: selection, Quick Test, Annotations, Study Focus, PPT

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff — OQ-1 placement, PDF annotation engine, FR-15 delta; gate: epic-08 done — **except T5 PPT: runnable any time after epic-00**)
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
