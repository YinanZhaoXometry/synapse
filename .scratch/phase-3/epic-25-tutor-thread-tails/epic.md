# Epic-25: tutor-thread-tails

Milestone: Phase 2 — post-deadline
Status: in-review (PR #23; T1–T4 done on epic/p3-25-tutor-thread-tails — rspec 1474 · vitest 951; merge = owner verification, then worktree+branch delete per the ruling)
Created: 2026-11-07 (owner: 「这些需要等其他的session的工作可以新开一个spec在另个git worktree里面搞互不干扰」)

## Scope

The demo-prep leftovers that need schema movement or a backend op — exactly the work that
had to wait on the main checkout's in-flight sessions, now unblocked by the worktree
discipline (workflow.md § Implementation worktree discipline; this epic IS the first
per-epic application of that ruling).

1. **Plan-scoped Companion threads (the 3b leftover).** The tutor page's plan-grounded
   chat is ephemeral by design (use-plan-companion-chat's honesty rule: "landing
   plan-scoped threads is schema movement no ticket owns") — a reload loses the whole
   transcript while the reader's material-scoped thread persists. This epic lands the
   schema movement: chat_threads gains a plan scope, the query/append surface grows a
   plan addressing mode, and the plan hook hydrates + persists with the SAME
   two-appends-per-completed-turn discipline the material hook pins.
2. **Real identity in the chrome (the footer leftover).** The sidebar footer renders the
   hardcoded "Yinan Chen" (scaffold prototype residue) while the actual session is
   demo@synapse.test — demo-visible. A minimal `me` query + chrome wiring.
3. **Nav riders** from the 2026-11-06 audit (small, no schema): the reader back label's
   loading flicker (audit #11) and the dashboard's double /planner KPI link (#12).

## Explicitly NOT here

- 问题2 (file+paragraph plan creation) — board-level feature, needs owner nomination per
  the phase-3 process; stays parked in the summary.
- Mobile bottom-nav rework — chrome spec'd in EXPERIENCE.md; owner-gated product call.
- Onboarding orphan route revival — product decision on the login-wall era's entry flow.

## Decisions (grill self-answered under delegation, 2026-11-07)

1. **Scope addressing = new column, not a new table.** chat_threads gains nullable
   `plan_id`; `material_id` relaxes to nullable; a CHECK constraint enforces
   exactly-one scope; unique indexes per scope (material implies owner, plan implies
   owner — user_id rides along for scoping reads). A separate table would fork the
   append discipline for zero reuse gain.
2. **New query field, extended mutation.** `planChatThread(planId:)` is a NEW field
   (the existing `chatThread(materialId:)` op and its typed clients stay frozen);
   `appendChatMessage` accepts materialId OR planId (exactly-one, VALIDATION_FAILED
   otherwise) — required→optional is wire-compatible for existing clients.
3. **Honesty rules carry over 1:1**: two appends per completed turn (user row then
   companion row), server-minted id/createdAt, nothing persists on failure/abandon;
   the ephemeral rule's REPLACEMENT is documented in the hook (a reload now hydrates).
4. **`me` is minimal**: email only (the chrome shows name = email local-part + avatar
   letter). No profile entity movement.
5. **Serial implementation** T1 → T2 → T3 → T4 (T1/T3 both move schema.graphql;
   T2 rides T1's ops); T5 closes.

## Baselines

rspec 1452 · vitest 936 · e2e 21 (CI-owned). Post-epic: +plan-thread specs, +me specs,
codegen regen gate must stay green.
