# T4 — Plan & study-task deletion with destructive confirm

Milestone: Phase 2 — post-deadline
Status: pending
Epic: epic-28-ux-hardening
Blocked by: T1–T3 (serial; schema movement + codegen last)

## Problem

Owner: 「学习计划、学习任务都无法删除…需要给个强提示，确认后方可删除」. Recon:
`deletePlan` is wired backend→hook (`useDeletePlanMutation`, plan-queries.ts:105-117)
but has ZERO UI consumers (PlanCard is a whole-card button, no menu);
study-task deletion doesn't exist on either stack (`backend/app/commands/tasks/` has
only create/promote; `tasks.graphql` has no delete doc).

## AC — backend (schema movement)

1. `Tasks::DeleteTaskCommand` (mirror `Plans::DeletePlanCommand`): ONE transaction —
   delete the study task, its owned material(s) and every dependent row pinned
   against schema.rb during implementation (quiz_sessions, flashcards,
   evidence_records, mistake_entries, chat_threads, reading_progresses,
   annotations/section_markings where the FK rides the material, promoted-pointer
   cleanup if the task was promoted from a plan — verify actual FKs, don't guess).
   Malformed/foreign uuid → `Failure(:NOT_FOUND)` (delta-2 posture).
2. `deleteTask` mutation + `DeleteTaskPayload` (returns `deletedTaskId: String!` for
   cache eviction), registered in mutation_type.rb; schema.graphql regenerated
   (codegen gate stays green); rspec: command unit (cascade, NOT_FOUND, scope) +
   mutation integration walk (the 742-line zero-factory house style).
3. Removal is destructive and documented in the schema field description
   (mirroring deletePlan's description style).

## AC — frontend

4. `DeleteTask` document + typed hook (evict task from cache; toast success/error
   keys from T2's convention: `tasks.deleteSuccess` / reuse error mapping).
5. Task page (`TaskHomePage.tsx` — the `/task/:id` shell): destructive icon affordance
   → shadcn AlertDialog (house pattern `SettingsPage.tsx:489-530` / promote-flow
   confirm): title `tasks.deleteTitle`, body `tasks.deleteBody` (states the material +
   records go with it), destructive confirm button (house destructive styling),
   cancel default. On confirm → mutate → toast → navigate to `/plans`.
6. Plans Home (`PlansHomePage.tsx`): trash icon button on each PlanCard (whole-card
   button kept — icon stops propagation, generous hit area, `aria-label`
   `plans.deleteAria`) → AlertDialog: `plans.deleteTitle` / `plans.deleteBody` (names
   the cascade: nodes, materials, quiz/mistake records; notes the refusal edge when
   a material is bound to a study task) → `useDeletePlanMutation` (already exists)
   → toast `plans.deleteSuccess`; backend error mapping toasts on refusal.
7. All new keys zh+en; vitest for dialog gating (cancel keeps everything, confirm
   fires the mutation once) on both surfaces; full gates green (tsc, eslint, vitest,
   codegen diff, build, container rspec).
