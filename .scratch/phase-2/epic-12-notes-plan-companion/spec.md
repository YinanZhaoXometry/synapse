# Spec: Epic 12 (Phase 2) — Notes with enrichment + plan-level Companion

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in PRD
> FR-40/22/46. **Delta-grill at kickoff** (OQ-11 image sourcing; Study Focus display OQ-1 belongs to
> epic-13). Gate: epics 08+10 done (FR-46 + weak-spot Notes consume epic-10's mapping/targeting).

## Problem Statement

Two AI promises remain unmet: **Notes** — AI-authored Markdown study documents from the user's materials, visually enriched where a picture aids understanding (FR-40), with a weak-spot-targeted variant (FR-22, UJ-5) — and the **plan-level Companion** — chat grounded in the whole plan's materials with citations, no Reading Position required, including "analyze my mistake" against a Notebook item's source section (FR-46), inherited by the retained `/ai-tutor` page when server AI lands. Both need exactly what earlier epics built: the adapter (05), mapping (10), and targeting (10).

## Solution

1. **Note generation + enrichment (T1, FR-40):** a `generateNote(scope)` mutation — scope = whole plan | node | material; standalone exportable Markdown persisted as a Note entity (user-scoped); **enrichment placement AI-selected by default** (image/chart at points where a visual aids understanding); user-requested image annotation at a chosen spot; **sourcing decision (OQ-11) at delta-grill** — v1 leans curated/diagram-safe sourcing (generated imagery is cost/quality risk; the cap counts calls either way).
2. **Weak-spot Notes (T2, FR-22):** the Note variant with `targeting: weakSpot` — scope selection biased by epic-10's targeting (low-mastery nodes, mistakes items); "aimed at what the learner has not yet demonstrated."
3. **Plan-level Companion (T3, FR-46):** plan-scope chat (plan home + empty state) through the existing SSE chat op with plan-scope context assembly (all attached materials, no Reading Position); answers cite Material + section; intent shortcuts per the scaffold tutor pattern (explain / quiz me / summarize / **analyze my mistakes** — the last grounds on a Notebook item's source section); the retained `/ai-tutor` page re-points to this grounding (its Phase-1 demo keyword responses retire).

## User Stories

1. As a learner, I can generate a study Note from my plan (or one node/material) and export it as Markdown.
2. As a learner, my Note gets visuals where they help, and I can request one at a chosen place.
3. As a learner staring at weak nodes, "make me a Note" targets what I haven't demonstrated.
4. As a learner at the plan home with nothing open, I can still ask the Companion — with citations into my materials — including "why did I get this wrong?"

## Implementation Decisions

- Note entity: markdown body + enrichment references (sourced asset urls/ids) + scope + attribution of targeting; export = download of the markdown (no new file pipeline).
- Enrichment assets ride storage (epic-06 presigned GET for curated assets) or markdown-safe references per the OQ-11 ruling; generated-image path is opt-in only if the delta-grill picks it.
- Plan-level chat reuses the epic-05 stream op with a `plan` grounding mode — no new SSE surface (AD-16's one-surface rule).
- "Analyze my mistakes" = a grounding input referencing a mistake entry id; assembly pulls its source section — same contract, cited.

## Testing Decisions

- Adapter-level specs with fixture materials: note scope correctness, enrichment placement markers, targeting bias (crafted scores), plan-chat citations, mistake-grounded answers.
- Web: note render (markdown + assets), export path, plan-chat UI states, /ai-tutor re-point — deterministic vitest on fixtures.
- Cap interplay: notes are AI calls (counted); assert CAP_REACHED surfaces sanely.

## Out of Scope

Study Focus (13 — Annotation-derived, different source) · in-reader selection UX (13) · Square/import (11) · any new question shapes.

## Further Notes

- Delta-grill items: OQ-11 sourcing ruling (recommend curated/diagram-safe v1), /ai-tutor retirement timing (with T3 vs deferred), note list/home placement.
