# Epic-28: ux-hardening

Milestone: Phase 2 — post-deadline
Status: in-progress (branch `epic/p3-28-ux-hardening` @ worktree `project-new-epic28-ux-hardening`; merge = owner verification, then worktree+branch delete per the ruling)
Created: 2026-11-10 (owner bug round: 「创建独立的epic 修复以下bugs，不影响main分支」)

## Scope

Three owner-reported bugs, one epic, explicitly OFF main:

1. **Session-expiry trap (T1).** A stale/expired JWT keeps the user inside the shell:
   every query comes back wire error `{ message: "authentication required",
   extensions.code: "UNAUTHORIZED" }` and the features just toast it — the token is
   never cleared, no redirect happens (the error sits in
   `backend/app/graphql/current_user_guard.rb:21-28`; the frontend has NO errorLink,
   `frontend/src/apollo/client.ts:34`). Fix: on in-shell UNAUTHORIZED → clear the
   session through the one seam (`logout()` = clearToken + resetApiClient) → hard
   redirect to `/login` carrying the current path in `?next=` → after login, resume
   that path + toast why. Deep-link `state.from` contract stays untouched.
2. **Key-path feedback (T2).** Critical-path actions complete silently: login/register
   success, logout, plan created, task created, material upload success, and
   deleteManualTask has NO handler at all (task-create failure even re-enables the
   button with zero explanation). Fill the toast gaps via sonner + i18n (zh/en parity
   is CI-enforced over the full table).
3. **Loading honesty (T3).** Every top-level page renders `null` while its query is in
   flight (11 pages audited, zero spinners) — the app looks broken during any slow
   fetch. AI surfaces are already good (companion typing dots, quiz/flashcard
   launchers with generating phases) — verified, NOT touched. Fix: one shared
   PageLoader applied to the blank pages.
4. **Deletion (T4).** Plans/tasks cannot be deleted from the UI at all:
   `deletePlan` is fully wired backend→hook (`useDeletePlanMutation`) but has ZERO UI
   consumers; study-task deletion doesn't exist on EITHER stack (no command, no
   mutation, no doc). Fix: backend `Tasks::DeleteTaskCommand` (cascade mirroring
   `Plans::DeletePlanCommand`) + `deleteTask` mutation + schema regen; frontend
   trash affordance + destructive AlertDialog confirm on plan cards and the task page.

## Explicitly NOT here

- No change to the RequireAuth deep-link wall (`App.tsx:64-70`, `state.from`) — its
  behavior is test-pinned (`auth-wall.integration.test.tsx:96,102`) and correct.
- No change to the per-feature UNAUTHORIZED toasts that already exist (mapping.,
  notes., square., … namespaces) — T1 adds the global teardown AROUND them.
- 今日学习 manual-task rows keep their one-tap delete (lightweight list row, owner
  didn't flag it) — T2 only adds the missing success/error toasts to it.
- No SSE-stream rework — sse-client only gains the same session-expiry dispatch where
  it already maps a terminal UNAUTHORIZED.
- Mobile bottom nav, onboarding revival, 问题2 creation rework — parked (epic-25 notes).

## Decisions (grill self-answered from recon, 2026-11-10)

1. **Expiry redirect = hard reload with `?next=`, not an SPA event bus.** The house
   pattern for session teardown is already `window.location.replace` (UserMenuButton,
   SettingsPage) — a full reload after `resetApiClient()` guarantees a clean slate
   with zero loop surface, and it works identically for the SSE path (no React
   dependency). Login page resolves destination as `location.state.from` (unchanged,
   pinned) → sanitized `?next=` (must start with a single `/`, no `//`, no scheme) →
   `/plans`. `&expired=1` / `&out=1` params drive the "why am I here" toasts
   (session-expired / signed-out).
2. **Guard by operation name, not by code path.** The errorLink skips `Login`/`Register`
   operations — UNAUTHORIZED there is "wrong password" and must keep the inline
   authErrorKey surface. Single-flight: the teardown runs only if a token still
   exists (first error wins; the rest are already post-teardown no-ops).
3. **Code is `UNAUTHORIZED`, not UNAUTHENTICATED.** The frontend comments saying
   otherwise (`client.ts:20`, `auth-token.ts:6`) are drift — fixed in passing.
4. **Task delete mirrors plan delete: hard cascade.** The task's material was uploaded
   for that task alone; orphaning it serves nobody (consistent with
   DeletePlanCommand's one-transaction cascade). Exact dependent list pinned against
   schema.rb during T4 — task row, its material(s), and every dependent row
   (quiz sessions, flashcards, evidence, mistakes, chat threads, reading progress).
   Guard: malformed/foreign id → NOT_FOUND (delta-2 posture), same as plan.
5. **Plan delete confirm copy states the cascade AND the known refusal edge**
   (DeletePlanCommand fails VALIDATION_FAILED while a plan material is bound to a
   study task) — the confirm dialog says so; the backend stays the enforcer.
6. **Serial implementation** T1 → T2 → T3 → T4 (T1/T2/T3 are frontend-only; T4 moves
   schema.graphql and needs codegen + container rspec). One branch, one PR.

## Baselines

main @ 6dcdb16 · vitest (worktree, fresh npm ci) measured at T1 start · rspec measured
in the dev containers at T4 · e2e 21 (CI-owned). Post-epic: codegen regen gate must
stay green (deleteTask schema movement), i18n zh/en parity must stay green.
