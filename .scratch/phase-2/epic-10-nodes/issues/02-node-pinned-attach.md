# 02: Node-pinned material attachment — scope plan|node (FR-44)

**What to build:** attachment scope field (default plan-wide — backward compatible); pin-to-node flow in plan/material UI; **enforcement at the adapter's context assembly**: a pinned material's sections feed only its node's grounding and quiz generation; re-attach plan-wide widens; pinned + plan-wide coexist on one plan.

**Blocked by:** 1.

**Status:** done (2026-11-05 — merged to `epic/p2-10-nodes` @ `c31b255` + plan_id hardening; gates: rspec 846 / rubocop clean / vitest 476 / tsc+eslint clean / build ok)

**Bound by:** FR-44 (never feeds other nodes unless plan-wide), AD-16 (assembly-level enforcement — asserted there), AD-13 (scoping).

- [x] Scope migration + op change default-safe; existing data reads plan-wide
- [x] Adapter-assembly spec: pinned content provably absent from other nodes' generation context
- [x] UI: pin/unpin/widen flows, bilingual, both themes

## Comments

- **2026-11-05 implementation:** `materials.attachment_scope` (default `"plan"`, CHECK `plan|node`) + nullable `node_id` FK (two-step strong_migrations, concurrent index); `plan_scope` = plan-wide materials ONLY (pinned provably absent, marker-substring specs); NEW `node_scope(plan, node)` = plan-wide + own pins (primitive; T5 owns consumption — none wired); attach op +`attachmentScope`/`nodeId` with the full combo matrix (task pins rejected, foreign/unknown/malformed node ids uniform NOT_FOUND); NEW `setMaterialScope` mutation (pin/unpin/widen, idempotent, deliberately not an attach-replay overload); `MaterialScopeControls` on PlanHome live rows (scope chip via node-title lookup, pin picker, widen; `scope.*` zh+en). Deviation judged in-AC by review: MaterialsPage demo rows carry the chip only (no server identity — pin/widen would fake mutations); flows live on PlanHome.
- Two-axis review round 1: both axes PASS; single P2 (node_scope pinned leg lacked plan_id constraint) fixed inline with targeted rubocop+spec verification (pure narrowing).
