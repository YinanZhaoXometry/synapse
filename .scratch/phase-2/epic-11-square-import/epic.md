# Epic 11 (Phase 2) — External plans: Square + roadmap.sh import

Status: done (2026-11-05 T1–T3 + two-axis reviews, merged to main; T4 roadmap.sh import = **wontfix by owner decision 2026-11-06** — content license forbids republishing and the owner declines to seek consent; FR-43 dropped, see ticket 04. Linking out to roadmap.sh stays allowed.)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-38/39/43 + OQ-12 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · spine **AD-13** (the single public-read exception — structure only, NFR-7; fork with attribution; import as build-time job) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-plan-visibility.md](issues/01-plan-visibility.md) | — (epic gate) | visibility set/change flows (FR-38) |
| 2 | [02-square-read-path.md](issues/02-square-read-path.md) | 1 | public-plan list/preview queries, reduced type set, public scope context (FR-39 api half) |
| 3 | [03-square-ui-fork.md](issues/03-square-ui-fork.md) | 2 | browse/preview/adopt surface + structure fork w/ attribution (FR-39 web half, OQ-12) |
| 4 | [04-roadmapsh-import.md](issues/04-roadmapsh-import.md) | — (parallel; license gate) | build-time fetch/parse job → plan, attribution + license (FR-43) |

## Definition of done

Public reads structurally cannot expose Materials/Annotations/Mastery (reduced types, asserted) · Private flip removes from Square · fork produces an independent attributed plan · one roadmap.sh import round-trip recorded with license note · gates green · every ticket cites FRs + AD-13.

## Coordination notes

- **Gate: epic-08 done**; mostly api-side → parallelizes with 09/10/13 (T4 is api-only + license-gated — start it whenever the license check clears).
- T1 uses epic-01's `visibility` column — no migration expected; if a field is missing it goes here, noted in Comments.
- Surface placement (sidebar vs plans-home) is a delta-grail UX call — confirm against the UX spine before T3.

## Coordination note (from epic P2-4 review, 2026-11-04)

Forward-note for T2 (02-square-read-path.md): when the FR-38/39 public-plan
read lands, `KnowledgeNodeType`'s score fields (`masteryScore`/`state`) will
compute for ANY node handed to them — they are plain field resolvers and know
nothing about the Square. NFR-7 (never Materials/Annotations/Mastery Scores on
the public path) therefore depends on the public wiring exposing a
STRUCTURE-ONLY node type — a separate public type without the score fields,
not the shared `KnowledgeNodeType` with fields toggled off.

Scoping postures, post-P2-4-review: the Mastery evidence loads are explicitly
user-scoped in both places — `DataloaderSources::EvidenceRecordsSource` (the
node score fields' batched load) and `StudyPlanType#mastery_score`'s grouped
load both run `EvidenceRecord.where(user_id: …)`. The surrounding structural
reads (plan/task/node/material lists) still ride the association-path
convention (the caller's own association chain is the scope). The public path
must use the stricter explicit scoping for anything it reads, and — per NFR-7
— it must not reach the score fields at all.

## Kickoff delta review — 2026-11-05 (decide-all delegation; one owner gate found)

1. **T4 LICENSE GATE = BLOCKED, owner-gated (ready-for-human).** Factual check 2026-11-05 (GitHub API, kamranahmedse/developer-roadmap `license`): roadmap.sh content is copyright-protected — "allowed to use this material for personal use but are not allowed to use it for any other purpose including publishing the... project files or the content"; sharing the content "taken out of the repository... from any other medium" requires prior consent. FR-43's import (serving roadmap structure through Synapse to its users) is exactly the forbidden use. T4 is NOT built; it flips to `Status: ready-for-human` with the license quote recorded in its Comments — unblocking requires the OWNER to obtain prior consent from the author (external, owner-side). FR-43 lands then.
2. **Square listing order v1 = newest-first public plans** (the ticket's "simple" option); no pagination v1 (a demo-scale board); recorded for T2.
3. **Surface placement (delta-grail UX call):** the Square is a TAB on the plans home (`PlansHomePage`: 我的计划 / 广场 pill toggle, 广场 = Square), NOT a new sidebar destination — the sidebar's ten retained destinations stay frozen; the plans home is the plan front door so external-plan discovery lives there. Preview = a dedicated route `/square/:planId` (addressable, AD-8 spirit).
4. **Attribution modeling:** `study_plans` gains nullable `forked_from_plan_id` (FK SET NULL — the source going private/deleted never breaks the fork) + `forked_from_topic` (title snapshot at fork time). Attribution renders as 「改编自公开计划：X」 on the forked plan (plans home row + plan home header). NO owner identity is exposed (public path is structure-only — an owner email/handle would leak more than NFR-7 allows).
5. **Public read context (T2, per the P2-4 forward-note):** `squarePlans`/`squarePlan` are unauthenticated-readable; a dedicated `Square` reduced type set (`SquarePlanType` topic/visibility/createdAt + node summaries; `SquareNodeSummaryType` title/stage/order ONLY — literally no material/annotation/score fields to select) + a schema-level assertion spec walking the public types' field sets. The fork command itself is an AUTHENTICATED mutation (adopting requires an account).
