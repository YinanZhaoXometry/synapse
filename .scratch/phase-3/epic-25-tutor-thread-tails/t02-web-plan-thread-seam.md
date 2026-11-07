# T2 — Web seam: plan thread hydration + persistence

Milestone: Phase 2 — post-deadline
Status: done
Epic: epic-25-tutor-thread-tails
Blocked by: T1

## AC

1. `npm run codegen` after T1's schema lands; committed types regenerate; codegen
   diff gate green.
2. `src/lib/graphql/`: new `planChatThread(planId:)` TypedDocumentNode + the append
   mutation's planId variant (same document, optional materialId/planId).
3. `src/api`: hooks for the plan thread read + the plan-scoped append (the material
   hooks untouched).
4. `use-plan-companion-chat`: hydrate the transcript from `planChatThread(planId)`
   once per plan (the entriesFromThread shaping the material hook uses); completed
   turns append user-then-companion rows (the two-append discipline, NOT idempotent —
   the driver owns exactly-once as in the material hook); failures/abandons persist
   nothing. The planId-switch reset effect stays (a switch re-hydrates from the new
   plan's server thread). The ephemeral-transcript honesty rule comment is REWRITTEN
   to the persisted rule (reload now hydrates — say so where the old rule lived).
5. Tests: hook/panel test for hydrate-once-per-plan + append-on-complete +
   switch-rehydrates; full vitest green; no fixture drift (Apollo4 lesson: new fields
   ride operations, not fragments pinned elsewhere).
