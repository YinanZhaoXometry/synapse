# Spec: Epic 13 (Phase 2) — Reader depth: selection, Quick Test, Annotations, Study Focus, PPT

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in PRD
> FR-13/14/16/17 + FR-15 delta + PPT (owner Q6). **Delta-grill at kickoff** (Study Focus display
> OQ-1; annotation tech on PDF text layers). Gate: epic-08 done. The PPT ticket is the roadmap's
> designated lane-filler — client-side, runnable any time after epic-00.

## Problem Statement

The flagship reader renders and tracks position, but the PRD's in-reader study machinery is unstarted or partial: selection shortcuts (FR-13) and Quick Test (FR-14) don't exist; Annotations (FR-16) have an entity but no surface; Study Focus (FR-17) is unbuilt with an open display decision (OQ-1); FR-15's claim+confirm marking shipped in Phase 1 but its PRD detail needs a delivered-scope delta check; and PPT uploads are rejected (owner Q6 defers them to "Phase-2 opening" — a client-side parse extension per AD-7).

## Solution

1. **Selection shortcuts (T1, FR-13):** text selection offers two one-click actions — **Ask Companion** (grounded in the selection) and **Quick Test**; selection bar UX per the UX spine; works on Markdown selections and PDF text-layer selections.
2. **Quick Test (T2, FR-14 + FR-15 delta):** 3–5 questions on the current selection or section via the generation op (targeting-capable per epic-10); results feed the Mistakes Notebook (wrong answers with source section) and Mastery Score evidence; FR-15 delta check folded here (confirm-quiz flow from marking matches PRD detail; gaps fixed in-ticket).
3. **Annotations (T3, FR-16):** multi-color highlights + underline, persistent, removable — on Markdown (section ranges) and PDF (text-layer ranges); the `annotations` entity from epic-01 goes user-scoped live.
4. **Study Focus (T4, FR-17 + OQ-1):** Companion generates core study items from one Material's Annotations, regenerable as annotations change; **display placement decided at delta-grill (OQ-1)** — recommendation: a reader-side panel surfaced on demand.
5. **PPT upload (T5, owner Q6):** accept `.pptx` — client-side parse extension per AD-7 (slides → sections: slide title + extracted text), same attach pipeline (metadata + sections + parse state); no server change.

## User Stories

1. As a learner, selecting a hard paragraph gives me Ask / Quick Test in one click — grounded exactly there.
2. As a learner, I can highlight in colors and underline, and it persists across sessions and devices.
3. As a learner, my annotations become a regenerable Study Focus of core items.
4. As a learner with lecture slides, I can finally upload the PPT and study it like any Material.

## Implementation Decisions

- Selection grounding extends the AD-5 contract with a selection input (text + position) — the UI renders the existing citation/contract chips.
- Annotation ranges are a domain shape (material id + locator + range) — no PDF-specific types in features; the reader maps its engine's ranges to the domain shape.
- Study Focus rides the AI seam (adapter, cap-counted) with annotation-derived context; regeneration replaces (no forked history v1).
- PPT parsing stays inside the reader feature's public `parse(file)` API — the attach flows stay unchanged (AD-7's promise).
- FR-15 delta: verify green-marking display, claim-not-evidence rule, unmark behavior against PRD text; deviations fixed here, not re-specced.

## Testing Decisions

- Selection/annotation: deterministic vitest on fixture documents (md + pdfjs text layer); position math edge cases (cross-section, cross-page).
- Quick Test: generation call shape, mistakes entries created, evidence recorded (integration with the api's factory-backed patterns).
- PPT: parser fixtures (slide → section), rejection of legacy-unhandled types gone, size guard.
- Accessibility floor: selection bar + annotation tools keyboard-complete, never-color-only.

## Out of Scope

Node-pinned scoping UI (10) · Notes (12) · OCR of image-heavy PPTs (parse extracts text only — limitation stated in UI) · collaborative annotations (never promised).

## Further Notes

- Delta-grill items: OQ-1 Study Focus placement, PDF annotation engine choice (native text-layer ranges vs a lightweight library — criteria: fidelity + bundle), FR-15 delta findings.
- T5 (PPT) may be pulled into any earlier window as lane filler — it has no epic-08 dependency; flag on the roadmap already.
