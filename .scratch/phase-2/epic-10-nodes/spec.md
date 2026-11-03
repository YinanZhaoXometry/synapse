# Spec: Epic 10 (Phase 2) — The node layer: mapping, pinning, states, roadmap graph, adaptive targeting

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in PRD
> FR-44/45/21/5/6/7 + the final-system prototype's 14-scene walkthrough. **Delta-grill at kickoff**
> (two real open decisions: the roadmap renderer OQ-2, and mapping's proposal UX). Gate: epic-08 done.
> This epic carries the PRD audit's two true gaps (FR-44/45).

## Problem Statement

Phase-1 plans are a skeleton with materials bolted on plan-wide: sections and nodes don't know about each other (no mapping — FR-45), materials can't scope to one node (FR-44), the plan renders as a list/tree rather than the roadmap-style graph (FR-5), node states don't visualize mastery (FR-6) or click through into study (FR-7), and generation is plan-blind — it never biases toward weak nodes (FR-21/FR-18's node-targeted half). These five FRs interlock as one layer: mapping feeds targeting, states ride scores, the graph renders both.

## Solution — five tickets, data model first

1. **Material–node mapping (T1, FR-45):** when a material attaches plan-wide, the AI (epic-05 adapter) maps sections → existing nodes and proposes new nodes for gaps; proposals await user confirmation before joining the plan; unmapped content surfaced, never silently dropped. Mapping rows (section ↔ node, proposed-node state) user-scoped.
2. **Node-pinned attachment (T2, FR-44):** attachment scope field (plan | node); pinned material's content scopes to that node's grounding + quiz generation only; pinned and plan-wide coexist; re-attach plan-wide widens scope.
3. **Node states + click-through (T3, FR-6/7):** node components render mastery-driven states (mastered threshold green, partial below — never color-only) live-updating as evidence lands; click-through opens the reader at a mapped section (anchor channel) or starts a node Quick Test.
4. **Roadmap graph (T4, FR-5):** the plan's interactive node graph — nodes grouped by stage, sequence edges, click for detail; **renderer decision at delta-grill (OQ-2: graph library vs custom SVG)**; layout usable at 30+ nodes (the PRD's perf bar); integrates T3's states.
5. **Adaptive targeting (T5, FR-21 + FR-18's node-targeted half):** generation input gains a targeting mode — bias toward low-mastery nodes and Mistakes-Notebook items (per-node scores from the one source, AD-6/14); Today's AI-suggestion slot (epic-09) and Quick Test (epic-13) consume it.

## User Stories

1. As a learner, attaching a material shows me how it covers my plan — mapped sections, proposed nodes for gaps, nothing silently dropped.
2. As a learner, I can pin a reference PDF to one node so its content stops leaking into other nodes' quizzes.
3. As a learner, the roadmap graph shows my mastery as color/state on nodes, and clicking a node takes me to study.
4. As a learner, "quiz me" leans toward what I'm weak at and what I got wrong.

## Implementation Decisions

- Mapping is AI-assisted but **user-confirmed** (owner Q5(a): plan = skeleton, material = flesh, both under user control); proposals are data rows, not ephemeral chat.
- Scope field extends epic-03's material-attach op (a migration + op change, backward-compatible: default plan-wide).
- Node states read the server-computed score fields (epic-04) — no client math; "live" = Apollo cache updates on evidence mutations.
- Targeting is an input mode to existing generation ops (epic-05), not a new AI surface; bias = selection weighting over candidate nodes, decided + recorded at delta-grill.
- Graph renderer choice gates on the 30+ node layout bar and bundle cost (pdfjs-style lazy import if heavy).

## Testing Decisions

- api: mapping proposal/confirm flows, scope-scoping (pinned content never feeds other nodes' generation context — asserted at the adapter-assembly level), targeting selection specs on crafted score distributions.
- web: mapping confirmation UI, node-state rendering vs score fixtures, graph render + interaction (vitest + a browser smoke at 30+ nodes), click-through anchors.
- Gates: web + api suites; bilingual/theme checks on all new surfaces.

## Out of Scope

Square/import (11) · plan-level Companion grounding (12 — consumes T1's mapping) · in-reader selection UX (13) · decay values (04-T4 interplay noted in both).

## Further Notes

- Delta-grill items: renderer pick (OQ-2), targeting weights, mapping-proposal UX density (plan with 40 sections must not drown the user).
- T4 can start in parallel with T1–T3 (renderer spike) but lands after T3 (states integrate).
