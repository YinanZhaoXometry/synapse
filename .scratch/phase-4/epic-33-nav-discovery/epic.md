# Epic 33 — nav-discovery

Milestone: Phase 4 — learning-engine season (owner-added non-engine epic, 2026-11-11)
Status: ready-for-agent
Design source: [../deeptutor-uiux-comparison.md](../deeptutor-uiux-comparison.md) §5.1-5.2 · Board row: [../roadmap.md](../roadmap.md)

## Scope

Two navigation gaps extracted from the DeepTutor UI/UX comparison (the learning-engine epics 29-32 are untouched by this):

1. **Records in the sidebar** — the 学习 group gains the user's recent plans as rows; every session today costs "Plans Home → card" two hops, and the sidebar holds no records at all.
2. **⌘K entity search** — the palette grows from page-nav + language toggle to finding plans/materials/tasks, reading the same client cache the pages already use (zero extra round trip on open).

Both are frontend-only: `usePlansQuery` / `useAllMaterialsQuery` / `query Tasks` already exist. Code-disjoint from epics 29-32 (touches `nav-items.ts` / `AppLayout.tsx` / `CommandPalette.tsx` + the typed hooks layer; no spine surfaces, no mastery semantics — server mastery fields render, never recompute, AD-14).

## Non-goals (uiux-comparison §6 — rejected with reasons, don't re-litigate)

- Category shelves / 5-tab sidebar — second IA level for 10 destinations is over-modelling; the records tree is the separable good half.
- Sidebar reorder / "More" folding — solves a problem 10 items don't have.
- Chat-first anything — FR-36 plan-first is settled.

## Delta-grill (self-answered under the standing delegation, 2026-11-11)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Sidebar sort key — plans query has no `updatedAt` yet? | Sort `createdAt` desc for now; adding a nullable `updatedAt` to `PlansDocument` is allowed **if** the ticket needs it for ordering, but is not required to ship. |
| Q2 | Does the plan row nest its Companion thread (DeepTutor files chats under records)? | Yes **when a cheap signal exists**. If "has companion activity" needs a new server field, a single nullable read field on the plans query is allowed (read-only, ADR-neutral); if the field grows past trivial, ship plan-rows-only and park the child — the row itself is the gap being fixed. |
| Q3 | Does ⌘K refetch on open? | Cache-first, background refetch allowed on open; never block the palette on the network (DeepTutor posture: same sources as the pages, no extra round trip on open). |

## Tickets

1. [t01-sidebar-plan-tree.md](t01-sidebar-plan-tree.md) — ready-for-agent, no blockers
2. [t02-command-palette-entities.md](t02-command-palette-entities.md) — ready-for-agent, no blockers; T2 is independent of T1 (may run in either order or parallel worktrees)
