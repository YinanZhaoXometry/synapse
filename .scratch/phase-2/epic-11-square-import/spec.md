# Spec: Epic 11 (Phase 2) — External plans: Square (visibility + discovery + fork) and roadmap.sh import

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in PRD
> FR-38/39/43. **Delta-grill at kickoff** (license posture for FR-43; Square listing shape). Gate:
> epic-08 done. Mostly api-side → parallelizes cleanly with 09/10/13.

## Problem Statement

Plans currently come only from AI generation. The PRD's Phase-2 promise adds two external sources: **other users' public plans** (visibility FR-38, Square discovery FR-39 — the single sanctioned AD-13 scoping exception: structure only, never Materials/Annotations/Mastery, NFR-7) and **roadmap.sh's curated roadmaps** (FR-43 — nodes/stages become a plan; attribution + license handling are build-time concerns the PRD routes to architecture). Both land on one pipeline: structure in → normal plan out.

## Solution

1. **Visibility flows (T1, FR-38):** the `visibility` column (epic-01) gets its surface — set at creation, changeable after; flipping to Private removes the plan from the Square; Public exposes **structure only** (enforced at the read path, not by UI discipline).
2. **Square read path (T2, FR-39):** the public-plan queries — list (by structure: topic, node/stage summary) + preview detail — as the AD-13 exception, enforced in a dedicated public scope context (asserted: no material/annotation/score fields exist on the public types at all).
3. **Square UI + fork (T3, FR-39/OQ-12):** browse/preview/adopt surface in-app; **fork = copy the structure** into the adopter's plan (own materials, own progress, attribution to the source plan preserved); adopted plan behaves identically to a generated one.
4. **roadmap.sh import (T4, FR-43):** an api build-time job + import flow — fetch/parse a chosen open-source roadmap (stages → node structure), license handling per delta-grill (roadmap.sh's content license verified and honored; attribution visible on the plan), imported plan identical in behavior; curated alternative to AI generation for engineer-growth topics.

## User Stories

1. As a learner, I can make my plan Public knowing only its skeleton is ever shared — never my materials, annotations, or scores (NFR-7).
2. As a learner, I can browse the Square, preview a plan's structure, and adopt it as my own with my own materials.
3. As an engineer-growth learner, I can import the roadmap.sh React roadmap as a ready-made plan with visible attribution.
4. As the api, every public read passes a dedicated scope context that structurally cannot leak user content.

## Implementation Decisions

- Public-plan GraphQL types are a **separate, reduced type set** — the leak-proofing is structural (no fields to select), not a linter rule.
- Fork copies structure + attribution in one command (idempotent on client uuid); the adopter's rows are theirs alone (FR-39).
- roadmap.sh import runs as a **build-time/one-shot api job** (per the spine's capability map), not a client fetch — attribution + license notes live on the plan record.
- Square needs no new navigation slot in v1 if the UX spine places it inside an existing surface; placement confirmed at delta-grill (sidebar vs plans-home tab).

## Testing Decisions

- Public-scope RSpec: the exception's boundary proven both ways (structure readable when public; content fields nonexistent; private plan absent from listings after flip).
- Fork specs: structure copied, materials/progress not, attribution present, idempotency.
- Import specs: parsed structure fixtures → plan rows; attribution/license fields set; failure paths (source unavailable) typed.

## Out of Scope

Social features beyond fork (ratings, comments — none promised) · full-text search of plans (listing is by structure) · importing user-uploaded arbitrary JSON roadmaps.

## Further Notes

- Delta-grill items: roadmap.sh license terms (verify before build — same posture as OQ-4's terms gate), Square surface placement, listing ordering v1 (recent/popular stub).
