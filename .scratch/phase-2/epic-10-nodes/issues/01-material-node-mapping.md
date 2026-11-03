# 01: Material–node mapping — AI maps sections, user confirms proposals (FR-45)

**What to build:** mapping rows (section ↔ node) + proposed-node state; on plan-wide attach, an AI mapping command (epic-05 adapter) proposes section→node assignments and **new nodes for coverage gaps**; the user confirms/rejects proposals before they join the plan; unmapped sections surfaced explicitly; mapping visible per material and per node.

**Blocked by:** None (epic gate: 08 done).

**Status:** ready-for-agent (delta-grill: proposal UX density at 40+ sections)

**Bound by:** FR-45 (every section maps or proposes; nothing silently dropped; user confirms), owner Q5(a), AD-16 (mapping runs through the adapter → cap-counted), AD-13 (user-scoped rows).

- [ ] Mapping command + confirm/reject ops; scoping context green
- [ ] Unmapped content surfaced in UI (explicit list, never dropped)
- [ ] Confirmed proposals become real nodes (evidence-ready); rejected proposals stay rejected (not re-proposed forever)
- [ ] Factory-based specs: full/partial/empty-mapping paths
