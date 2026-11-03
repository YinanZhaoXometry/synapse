# 02: Node-pinned material attachment — scope plan|node (FR-44)

**What to build:** attachment scope field (default plan-wide — backward compatible); pin-to-node flow in plan/material UI; **enforcement at the adapter's context assembly**: a pinned material's sections feed only its node's grounding and quiz generation; re-attach plan-wide widens; pinned + plan-wide coexist on one plan.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-44 (never feeds other nodes unless plan-wide), AD-16 (assembly-level enforcement — asserted there), AD-13 (scoping).

- [ ] Scope migration + op change default-safe; existing data reads plan-wide
- [ ] Adapter-assembly spec: pinned content provably absent from other nodes' generation context
- [ ] UI: pin/unpin/widen flows, bilingual, both themes
