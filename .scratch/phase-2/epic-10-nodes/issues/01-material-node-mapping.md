# 01: Material–node mapping — AI maps sections, user confirms proposals (FR-45)

**What to build:** mapping rows (section ↔ node) + proposed-node state; on plan-wide attach, an AI mapping command (epic-05 adapter) proposes section→node assignments and **new nodes for coverage gaps**; the user confirms/rejects proposals before they join the plan; unmapped sections surfaced explicitly; mapping visible per material and per node.

**Blocked by:** None (epic gate: 08 done).

**Status:** ready-for-agent (delta-grill: proposal UX density at 40+ sections)

**Bound by:** FR-45 (every section maps or proposes; nothing silently dropped; user confirms), owner Q5(a), AD-16 (mapping runs through the adapter → cap-counted), AD-13 (user-scoped rows).

- [ ] Mapping command + confirm/reject ops; scoping context green
- [ ] Unmapped content surfaced in UI (explicit list, never dropped)
- [ ] Confirmed proposals become real nodes (evidence-ready); rejected proposals stay rejected (not re-proposed forever)
- [ ] Factory-based specs: full/partial/empty-mapping paths

## Comments

- **2026-11-05 implementation:** landed on `epic/p2-10-nodes` (merge `a69dc05`): `material_node_mappings` (unique active row per user+material+section; status `proposed|confirmed|rejected` in place), `Ai::MapMaterialSectionsCommand` (cap-counted through the AD-16 seam; confirmed rows never overwritten; rejected sections never re-proposed; garbage reply entries demote to Unmapped — never a silent drop), bulk `confirmMappingProposals`/`rejectMappingProposals`, query `materialNodeMappings(materialId:)`, and the four-group `MaterialCoveragePanel` (Mapped / Proposed bulk confirm-reject / Rejected folded / Unmapped) integrated on PlanHome material rows. Deviations recorded at review, all judged within the binding deltas: rejected/confirmed rows in verdict payloads return unchanged; proposed rows pointed at an existing node group under that node's title and confirm with a status flip (no node creation); created nodes carry `stage: null` (no reliable server-side inference — stage assignment stays a human/epic-13 concern); explicit "Map sections" action (spec's "on attach" auto-run deliberately not taken — user controls AI spend, AD-16 cap).
- **Deferral recorded (compliance review):** the "mapping visible per **node**" half of the What-to-build line lands with T3/T4's node surfaces (click-through target list + graph node detail panel) — a per-node mapped-sections view needs the node detail surface those tickets build; not silently dropped, tracked here.
- Two-axis review round 1: contract 6 findings + compliance 5 (deduped 7: 3×P1 cross-plan confirm grouping / mapping_scope budget / plan-cache refetch; 4×P2 nodeId description / mutation naming / schema.rb churn / panel error state) → fix branch `epic/p2-10-t01-fix`.
