# 01: Plan visibility flows — Public/Private (FR-38)

**What to build:** visibility set at plan creation (default Private) + changeable afterwards (plan settings surface, bilingual); the flip immediately governs the Square read path (T2 consumes); flipping to Private removes the plan from Square listings.

**Blocked by:** None (epic gate: 08 done).

**Status:** done (2026-11-05 — branch `epic/p2-11-t01-visibility`; gates: rspec 1077 / rubocop clean / vitest 657 / tsc + eslint + build green)

**Bound by:** FR-38 (changeable; private removes from Square; public = structure only — NFR-7 enforced downstream in T2), AD-13 (user-scoped writes).

- [x] Set-at-create + change ops; scoping context green
- [x] UI affordance on plan settings with clear structure-only disclosure (zh+en)
- [x] Flip behavior asserted at the model/query level (not just UI)

## Comments

Implementation landed 2026-11-05 (branch `epic/p2-11-t01-visibility`, one commit on `f641d05`).

**Epic-01 visibility handling verification — NO migration needed.** The column is already the
closed FR-38 shape end to end: `20261104090002_create_study_plans.rb` carries
`t.string :visibility, null: false, default: "private"` + the `study_plans_visibility_check`
check constraint pinning `IN ('private','public')`; the model pins the enum (`enum :visibility,
{ private: "private", public: "public" }, default: :private, scopes: false` — scopes off because
`private` collides with `Module#private`); `Plans::VISIBILITIES` + `DEFAULT_VISIBILITY`
single-source the vocabulary; `CreatePlanCommand` (via `Plans::PlanCreation`) validates + persists
with the private default and was ALREADY spec-covered (command-level default/enum-refusal/public
passthrough + the wire spec reading visibility back). This ticket only added a wire PIN for the
explicit-public create (createPlan `visibility: "public"` → reads back `public`).

**Backend additions:** `Plans::SetPlanVisibilityCommand` (verb-first per the ticket; the
manual-task done-toggle idempotency law — same state → the unchanged row, `updated_at` untouched;
uniform NOT_FOUND matrix unknown/foreign/malformed; closed-enum VALIDATION_FAILED) +
`Mutations::Plans::SetPlanVisibility` (`setPlanVisibility(planId, visibility)`, registered in
`MutationType`) + `StudyPlan.publicly_visible` (hand-declared scope — the enum's auto-scopes are
off) with flip-semantics model specs both ways. `updatePlan`'s existing visibility patch stays
(the patch surface predates this ticket); the flip is the named, confirm-gated product action.
Schema re-dumped: +48 lines, exactly the new mutation/input/payload types; auth_surface roster
grew `setPlanVisibility`. Full suite 1077 examples green (baseline 1064 + 13), rubocop clean.

**Frontend:** `SetPlanVisibility` op in `plans.graphql` (+ `visibility` on the `Plans` list
query) → codegen committed; `useSetPlanVisibilityMutation` with the Plan read-back sweep
(`refetchQueries: [PlanDocument]` — the chip flips from server truth, never optimism);
`StudyPlanView` gains `visibility` (server column, AD-14 posture). Plan Home header gets
`PlanVisibilityControls`: state chip (私密/Public) + popover confirm step carrying the
STRUCTURE-ONLY disclosure (公开后仅共享计划结构（阶段与节点），永不包含资料、标注或成绩); sonner
success/error toasts through `apiErrorKeys("visibility.")`. The create wizard's confirm step
(the UI never surfaced the arg before) gained the private/public choice with the same
disclosure, `visibility` crossing the wire on createPlan (default private, reset after create).
i18n `visibility.*` namespace zh+en with a parity spec; `tsconfig.app.tsbuildinfo` regenerated
(the three new files — legit path change, committed per A6). Vitest 657 green (baseline 647 + 10),
tsc/eslint/build green.

**For T2:** the Square read path governs itself by `StudyPlan.publicly_visible`; the flip's
read-path effect is T2's to wire and assert (this ticket asserts only the model-level truth —
public → in scope, private → out, both spec-pinned). `StudyPlanView.visibility` is available on
the plans-home list rows too (`Plans` query now selects it) for T3's tab split.

**Test-env note:** gates ran on an isolated compose project (`-p synapse-t11`) with a /tmp
`!override` port-unpublishing file (the sibling p2-12 worktrees own the shared dev stack's
3000/9000); no repo files touched for it.
