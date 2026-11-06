# Epic 16 (Phase 3) — Interactive roadmap: real prerequisite edges, DAG layout, reading-mode upgrades

Status: ready-for-agent (spec'd + ticketed 2026-11-06, one pass under the standing decide-all delegation; grill round 1 self-answered — see delta review)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) · optimizes FR-5 on top of FR-6/7 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.1, all three shipped in Phase 2) · ADR-0001 + AD-6/14 (evidence-only, one score source) · AD-9 (accessibility floor) · NFR-6 (bundle discipline) · epic-10 delta decision 1 (amended here, not overturned) · clean-room roadmap.sh teardown 2026-11-06 (content license forbids reuse — FR-43 wontfix stands; behavior study only) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-roadmap-data-model.md](issues/01-roadmap-data-model.md) | — (epic gate) | edges table + node description/optional, proposal schema upgrade, creation/fork/seed wiring, GraphQL surface (FR-5 data half) |
| 2 | [02-dag-layout.md](issues/02-dag-layout.md) | 1 | typed hooks for edges/metadata, deterministic swimlane DAG layout + orthogonal routing, legacy fallback (FR-5 layout half) |
| 3 | [03-graph-ux.md](issues/03-graph-ux.md) | 2 | node vocabulary (optional dashed, group tint), progress bar, fit-view, deep-link, tooltip, sheet description; keyboard contract preserved |
| 4 | [04-e2e-and-close.md](issues/04-e2e-and-close.md) | 3 | stub provider 16-node proposal, e2e graph specs, dual-theme smoke, spine delta record + board update |

## Definition of done

Edges are real data the AI expresses and the server validates (every drop rule pinned by spec) · forks and the demo seed carry edges · legacy plans render via fallback, nothing breaks · layout is deterministic and test-pinned at 16 nodes · optional nodes dashed + not-color-only · progress bar reads server states only (no manual marking anywhere) · deep-link and fit-view work · AD-9 keyboard contract regression-free · both themes + reduced-motion verified · `just spec` + e2e green · spine Deferred row amended.

## Coordination notes

- **Gate satisfied (2026-11-06):** the uuid-fallback + e2e-harness batch landed on main via PR #16 (`3f55e1b`) — cut `epic/p3-16-roadmap` from main; T4 extends that harness (now 15 specs, rspec 1290 / vitest 836 baseline).
- T1 is backend-only (rspec-gated); T2/T3 frontend (codegen gate rides T2); T4 integrates.
- Touches the same files as epic-10 T4 (renderer + layout) — expect its test suite to be amended, not bypassed; every existing keyboard/aria assertion must survive.

## Kickoff delta review — 2026-11-06 (decide-all delegation, grill round 1 self-answered)

Grounded in code recon @ `e30d112`: `knowledge_nodes` carries only stage/order (+server mastery); no edge/position/optional/description anywhere; AI proposal emits `stages[].nodeTitles` only; the renderer derives pseudo-edges from global order. Owner fork questions (rendering stack, v1 scope, node cap) went unanswered under delegation — recommendations applied:

1. **Rendering stack = custom SVG stays, zero new dependencies** (React Flow + ELK rejected: 60–150KB gz vs NFR-6; ≤16-node swimlane graphs don't need a canvas engine; the epic-10 keyboard/pan/zoom contract is test-pinned and a library would force its focus model). This *amends* epic-10 delta decision 1 (columns + derived edges → swimlanes + persisted edges + orthogonal routing), recorded in the spine at T4.
2. **v1 = reading mode only.** Editor (drag/connect, persisted positions) is a separate epic if ever wanted; right-click quick-marking is rejected on domain grounds — progress is evidence-derived (ADR-0001), a manual "mark done" would be a honesty violation, not a shortcut.
3. **Node cap relaxed 3–8 → ≤16.** Bigger than roadmap.sh's 50–100 is out: AI edge-structure quality degrades and every node must stay mastery-coverable (materials + quizzes) for the loop to close.
4. **Edge semantics = soft learning-order, stage-forward only** (source stage index strictly < target's): cycles impossible by construction, routing stays in-metaphor; back-jump edges dropped at confirm. No gating/locking of any kind.
5. **Data model:** explicit `knowledge_node_edges` join table (uuid, plan, from, to; unique [from,to]); `description`/`optional` on nodes; **no position columns** — layout is a deterministic pure function (an editor, if ever, adds positions then).
6. **Title-paired edges in the proposal JSON, id-paired on the wire:** the AI emits `edges[[fromTitle,toTitle]]`; the frontend resolves titles against its client-supplied node ids in the existing flatten seam; the create mutation carries id pairs; the server validates membership/forward/dedupe and drops silently-but-logged. Duplicate titles → edge dropped (deterministic; the prompt asks for unique titles but does not trust them).
7. **Legacy plans:** zero-edge plans render the current derived-sequence fallback, selected per-plan by edge presence; no data migration (edges are a new-generation artifact; backfilling fake edges would be dishonest structure).
8. **roadmap.sh license honesty:** structural/behavioral vocabulary only (rounded nodes, orthogonal lines, dashed optional, group tints) mapped to our semantic tokens; no copied colors, text, layout data, or content — the teardown was clean-room (repo is markdown-only anyway; the renderer was never public).
