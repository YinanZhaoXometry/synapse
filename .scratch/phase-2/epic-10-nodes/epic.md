# Epic 10 (Phase 2) — The node layer: mapping, pinning, states, roadmap graph, adaptive targeting

Status: ready-for-agent (spec + tickets 2026-11-03; delta-grill at kickoff — renderer OQ-2, targeting weights, mapping UX; gate: epic-08 done)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-44/45/21/5/6/7 + FR-18's node-targeted half ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.1) · owner Q5(a) skeleton/flesh ruling · AD-6/14 (one score source), AD-7/8 (reader anchor channel), AD-16 (targeting is generation input) · [spec.md](spec.md). Carries the PRD-audit true gaps (FR-44/45).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-material-node-mapping.md](issues/01-material-node-mapping.md) | — (epic gate) | AI section→node mapping + proposed-node confirmation flow (FR-45) |
| 2 | [02-node-pinned-attach.md](issues/02-node-pinned-attach.md) | 1 | attachment scope (plan\|node), scoping enforced in generation context (FR-44) |
| 3 | [03-node-states-clickthrough.md](issues/03-node-states-clickthrough.md) | 1 | mastery-driven node states + reader/QuickTest click-through (FR-6/7) |
| 4 | [04-roadmap-graph.md](issues/04-roadmap-graph.md) | 3 | interactive stage-grouped graph, 30+ node bar, renderer per delta-grill (FR-5, OQ-2) |
| 5 | [05-adaptive-targeting.md](issues/05-adaptive-targeting.md) | 1, epic-05 | low-mastery + mistakes bias on generation; FR-18 node-targeted half (FR-21) |

## Definition of done

Every attached section maps or proposes (nothing silently dropped) · pinned content provably scoped · node states live on real scores · graph usable at 30+ nodes in both themes · generation biases per recorded weights · all gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epic-08 done.** Biggest post-cutover epic — start it first per the roadmap's risk ordering.
- T4's renderer spike may start early (parallel with T1–T3); T4 lands after T3.
- **Epic-12 depends on T1** (plan-level grounding uses section→node mapping); **epic-09-T3's suggestion slot consumes T5** (re-gate if ordering flips).

## Kickoff delta review — 2026-11-05 (decide-all delegation, "全部按推荐")

Grounded in code recon @ `fcc8fe3`: `KnowledgeNode` already carries server `masteryScore`/`state`/`stage`; `Material` has no scope/node linkage; `Ai::ContextAssembler.plan_scope` pulls ALL plan materials (T2's enforcement point); `MistakeEntry belongs_to node` (T5's per-node bias source); reader anchor channel (`readerAnchorHref`/`readerSectionHref`) already exists (T3 consumes it); `PlanHome` `NodeRow` already renders server `state` + score.

1. **OQ-2 renderer (T4) = custom SVG, deterministic stage-column layout — no graph library.** Criteria trail: (a) bundle discipline (NFR-6) — reactflow/d3 cost 60–150KB gz for layout we don't need; (b) the data model is a total `order` + stage labels, so deterministic columns ARE the structure-faithful rendering — a force/dag layout would be less faithful; (c) AD-9 keyboard path is trivial on semantic SVG (`tabIndex` per node `<g>` + arrow-key traversal) vs fighting a library's focus model; (d) lazy-import posture becomes moot (no lib to split). Edge vocabulary: consecutive-`order` edges within a stage + one connector from each stage's last node to the next stage's first node. Pan = drag (transform), zoom = buttons + ctrl-wheel, reduced-motion honored.
2. **Targeting weights (T5) = deterministic per-node weight, recorded:** `w(node) = 1 + (100 − masteryScore)/50` (score 100 → 1.0, 0 → 3.0), `+1.0` flat bonus when the node has ≥ 1 mistake entry, total capped at 4.0. Question allocation across candidate nodes by largest-remainder over weights; sections sampled within the allocated node's eligible sections (pinned→node, else plan-wide). FR-18 invariant asserted at selection: every sampled section belongs to a material attached to the scope. No new AI surface (AD-16) — the weights feed the existing prompt/selection path.
3. **Mapping proposal UX density (T1) = per-material coverage panel, four collapsible groups:** Mapped (section → node, one line each) · Proposed (grouped by proposed node, bulk confirm/reject per group) · Rejected (muted rows, never re-proposed) · Unmapped (explicit list). Every section lands in exactly one group — nothing silently dropped (FR-45). Per-section manual re-assign deferred to epic-13's selection UX. Rejected proposals persist as rows with status `rejected`; future mapping runs skip them.
4. **Data model (from the spec, pinned here):** T1 adds `material_node_mappings` (user, material, node nullable, section_id, proposed_node_title nullable, status `proposed|confirmed|rejected`; one active row per user+material+section). T2 adds `attachment_scope` (default `"plan"` — backward-compatible) + nullable `node_id` on materials.

