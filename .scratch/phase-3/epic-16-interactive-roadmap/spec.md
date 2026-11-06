# Spec: Epic 16 (Phase 3) — Interactive roadmap: real prerequisite edges, DAG layout, reading-mode upgrades

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-06 under the standing decide-all delegation (grill round 1 self-answered, all
> recommendations logged below and in the epic's kickoff delta review). Grounded in a verified
> clean-room teardown of roadmap.sh (2026-11-06: content repo is markdown-only, custom renderer not
> public, license forbids content redistribution — FR-43 wontfix stands) + code recon of the epic-10
> renderer. Optimizes FR-5 (the graph) on top of FR-6/7 (states/click-through, shipped epic-10).
> **Amends epic-10's kickoff delta decision 1** (custom SVG stays; stage columns + derived edges →
> stage swimlanes + persisted edges + orthogonal routing).

## Problem Statement

The plan graph lies about structure. Nodes render as stage columns whose "sequence" edges are
invented by the renderer from a global order field — the AI can't tell the learner that HTTP
precedes REST, that a node is optional, or why a node exists (no descriptions, no optional flag, no
edge data anywhere in the schema). There is no plan-level progress overview, no deep-linking into a
node, and the bezier pseudo-edges read as decoration, not dependency. The owner wants the
roadmap.sh-grade reading experience: a real dependency graph with orthogonal routed edges, node
types, and progress — and the AI's plan proposals currently cannot express any of it.

## Solution — four tickets, data first

Real prerequisite edges as persisted data, expressed by AI generation, rendered by a deterministic
layered layout in the existing custom-SVG canvas — reading mode only, evidence-honest throughout:

1. **Data model (T1):** a node-edge table + node description/optional fields; AI proposal schema
   upgraded to emit per-node metadata and title-paired edges; creation confirm persists edges after
   server-side validation (forward-only, deduped, membership-checked); fork and demo seed carry
   edges; GraphQL surface extended (codegen-gated).
2. **Layout engine (T2):** a pure deterministic DAG layout — stage = swimlane column, within-column
   barycenter ordering to minimize crossings, orthogonal elbow edge routing; legacy edgeless plans
   keep the epic-10 derived-sequence fallback; byte-identical determinism pinned by tests.
3. **Graph UX (T3):** node vocabulary (solid topic nodes, dashed optional nodes, tinted stage-group
   containers), plan progress bar (mastered/total — server states only), fit-view, deep-link
   `?node=`, hover tooltip, side sheet gains description + optional badge; the AD-9 keyboard
   contract (roving tabindex, pan-into-view) is preserved, not rebuilt.
4. **E2E + close (T4):** stub AI provider upgraded to emit a fixed 16-node edge-carrying proposal;
   e2e covers the graph surface; dual-theme smoke; spine delta record + board update.

## User Stories

1. As a learner, I want the graph's arrows to show what actually depends on what, so that I can
   pick a valid study order instead of guessing from column position.
2. As a learner, I want optional nodes drawn dashed, so that I can skim a plan and know what I may
   skip without losing the thread.
3. As a learner, I want each node to carry a one-line description, so that I can tell what a node
   covers before opening its material or quiz.
4. As a learner, I want a plan progress bar (mastered x of y), so that I can see how far along the
   whole roadmap I am at a glance.
5. As a learner, I want per-stage progress on each group container, so that I know which stage is
   holding me back.
6. As a learner, I want to deep-link to a node (URL with node id), so that I can bookmark or share
   "start here" pointers into my plan.
7. As a learner, I want the canvas to fit the whole roadmap on demand, so that I never feel lost
   after zooming into a corner.
8. As a learner with an older plan, I want it to keep rendering sensibly (sequence fallback), so
   that nothing breaks when the new graph ships.
9. As a learner, I want node progress to reflect only confirmed evidence, so that the graph never
   flatters me (no manual "mark as done" — ever).
10. As a learner, I want the graph usable by keyboard exactly as before, so that accessibility
    doesn't regress when visuals upgrade.
11. As a learner on a forked plan, I want the fork to carry the same edges, so that the copy stays
    faithful to the source structure.
12. As the AI plan generator, I want the proposal schema to express node metadata and edges, so
    that the plan I propose renders as a true roadmap.

## Implementation Decisions

- **Edge semantics: soft learning-order dependencies.** No gating/locking (nothing is locked by
  prerequisites); no manual progress marking — roadmap.sh's Done/In-Progress maps to our
  server-derived `mastered`/`partial` states; "Skipped" has no equivalent and is not introduced.
  Evidence-only progress per ADR-0001 + AD-6/14.
- **Data model:** `knowledge_node_edges` (uuid pk, plan, from-node, to-node, timestamps; unique
  [from, to]); `knowledge_nodes` gains nullable `description` and `optional` (default false). No
  position columns — layout is derived deterministically; an editor would add positions later.
- **Edge validity is stage-forward:** an edge is valid iff the source node's stage index is
  strictly lower than the target's. This makes cycles impossible by construction (no cycle
  detection needed) and keeps routing inside the swimlane metaphor. Back-jump edges are dropped at
  confirm.
- **Creation flow:** the AI proposal JSON upgrades to
  `stages[].nodes[{title, description, optional}]` + `edges[[fromTitle, toTitle]]`; the frontend
  resolves title pairs to its client-supplied node ids when building the create input (existing
  flatten seam); the create mutation carries node metadata + id-paired edges; the server validates
  membership, forward-only, and dedupe, dropping invalid edges silently-but-logged (a dropped edge
  degrades visuals, never blocks creation). Duplicate node titles make title-paired edges
  unresolvable — dropped, deterministic.
- **Scale cap: ≤16 nodes per plan** (relaxed from 3–8). The proposal prompt constrains node count,
  per-stage node counts, and requires every non-first-stage node to have ≥1 inbound edge.
- **Renderer stays custom SVG, zero new dependencies** (amended epic-10 delta decision 1): the
  canvas interactions (pan/zoom/clamps, keyboard contract, reduce-motion) already exist and are
  test-pinned; the increments are layout + edge vocabulary + node types, none of which need a
  graph library at ≤16 nodes. NFR-6 stands.
- **Layout:** pure function, deterministic (byte-identical output pinned by test): stage columns as
  swimlanes ordered by stage position; within-column order by barycenter of inbound edge sources
  (ties broken by node id); orthogonal elbow polylines between column boundaries (no obstacle
  avoidance); optional nodes render dashed per the shared node-state vocabulary.
- **Legacy fallback:** plans with zero persisted edges render the existing derived sequence edges
  (current behavior, kept as fallback path; selected per-plan by edge presence).
- **Fork + seed:** plan fork copies edges alongside nodes; the demo seed's plan gains a truthful
  edge set so the graded demo shows the real experience.
- **Visual language:** roadmap.sh's structural vocabulary only (rounded solid nodes, orthogonal
  lines, dashed optional, tinted group containers) mapped entirely onto existing semantic tokens —
  dark/light + all palettes verified; no copied colors, copy, or content (license honesty). The
  approved target is pinned by [style-reference.html](style-reference.html) (zero-dependency mock,
  owner sign-off 2026-11-06): its inline light-dark() colors are approximations — every value maps
  to the app's real CSS-variable tokens in implementation.
- **Zoom posture:** plain wheel-zoom inside the bounded canvas (roadmap.sh behavior; the canvas is
  a fixed-height contained surface, so page-scroll hijack is not a concern), ctrl/cmd+wheel kept as
  an alias; clamp and step unchanged from epic-10.
- **Deep-linking:** `?node=<id>` selects and pans to a node on mount (reusing the existing
  pan-into-view path); the side sheet opens as if clicked.

## Testing Decisions

- Good tests assert external behavior only: what the GraphQL surface accepts/rejects, what the
  layout computes for a given graph, what the rendered graph exposes (roles, labels, states,
  interactions) — never internal call shapes.
- api (rspec): creation-with-edges request specs pinning each validation rule (membership drop,
  same-stage drop, backward drop, dedupe, duplicate-title unresolvable drop); fork-copies-edges;
  seed-has-edges; node field round-trip; prompt fixture asserts the upgraded proposal shape.
- web (vitest): layout function — determinism (byte-identical), no-overlap geometry, barycenter
  ordering, elbow path endpoints, 16-node case, empty/legacy input; graph component — optional
  dashed + not-color-only, progress bar counts from server states, deep-link select + pan, fit-view,
  fallback path, keyboard contract regression (roving tabindex, pan-into-view, Esc), i18n keys
  zh/en both present. Prior art: the epic-10 layout + graph suites are the templates.
- e2e: stub provider emits the fixed 16-node proposal (including an optional node and a
  dropped-edge case); specs cover graph view default, node sheet, deep-link, progress bar. Prior
  art: the critical-flow suite's stub-provider pattern.
- Gates: `just spec` (web + api) green; codegen freshness gate; mastery-vector anti-drift
  unaffected (no mastery math touched).

## Out of Scope

- Roadmap editor (drag-to-reposition, manual connect/disconnect) — positions would need
  persistence; separate epic if ever.
- Back-jump (later→earlier stage) edges, per-edge labels, edge weights.
- Minimap, touch pinch-zoom (deferred with the broader touch-interaction batch).
- Sub-topic nesting (stage containers are the only grouping level).
- Node unlocking/gating of any kind; any manual progress marking.
- roadmap.sh content import — FR-43 remains wontfix (license; owner 2026-11-06).
- Raising the node cap beyond 16; two-stage AI generation for large graphs.

## Further Notes

- Spine delta record (T4): amend the Deferred table's "Roadmap renderer" row and epic-10's delta
  decision 1 trail — custom SVG retained, structure upgraded to persisted-edge DAG; new deferred
  rows: roadmap editor, back-jump edges, touch pinch.
- All grill round-1 assumptions are logged in the epic's kickoff delta review; owner may veto any
  line asynchronously — each is one spec/decision line, not architecture.
- Repo hygiene note (satisfied 2026-11-06): the uuid-fallback + e2e-harness batch landed on main
  via PR #16 (`3f55e1b`) — epic-16 cuts from main freely; T4 extends that harness.
