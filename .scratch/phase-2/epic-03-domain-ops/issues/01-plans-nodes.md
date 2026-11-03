# 01: Plans + nodes operations

**What to build:** GraphQL create/read/update for StudyPlan (title, topic/goal, visibility passthrough) and its KnowledgeNodes; **proposal-confirm persistence** — the creation chat's staged node proposal (arriving from epic-05's stream at runtime; here it's just an input payload) confirms into a plan + nodes in one command; plan listing (current user's) + detail with node tree; client-supplied uuid on creates.

**Blocked by:** None (epic gate: epics 01+02 done).

**Status:** done

**Bound by:** AD-12 (thin ops over commands), AD-13 (user-scoped; scoping context inherited), AD-6 (task-nodes: planId set, taskId null).

- [x] Plan CRUD + list/detail ops; thin resolvers only
- [x] Proposal-confirm command: payload → plan + nodes, one transaction, idempotent on client uuid
- [x] Node tree read; every op passes the scoping context (cross-user FORBIDDEN/NOT_FOUND per enum)
- [x] Mastery-field placement decision recorded in `## Comments` (expose placeholder vs epic-04 adds)
- [x] Direct-execution RSpec: happy + scoped + failure paths

## Comments

Built 2026-11-04 on `epic/p2-3-t01-plans-nodes` (base `epic/p2-3-domain-ops` @ `b7c7e6b`). Gates: rspec **292 examples, 0 failures** (247 baseline + 45 new), rubocop **153 files, no offenses** (133 baseline), schema re-dump idempotent (`schema_dump_spec`), `pnpm codegen` regenerated `frontend/src/types/graphql.ts` (gitignored, not committed) and `frontend/node_modules/.bin/tsc -b` green — no frontend file changes landed.

**Mastery-field placement (the AC decision, per kickoff delta 1):** OMITTED. `masteryScore` is not on `StudyPlan`/`KnowledgeNode` in this epic's contract — no placeholder nulls. Epic-04's ticket 3 adds the mastery fields + resolver bodies to the existing types; nothing here needs moving for that (the types are the host).

**Schema diff (353 insertions, exactly this ticket's surface):** Query `plans` + `plan(id:)`; Mutation `createPlan` / `confirmProposal` / `updatePlan` / `deletePlan`; types `StudyPlan` (id/topic/goal/visibility/createdAt/nodes) + `KnowledgeNode` (id/planId/taskId/stage/title/order/createdAt); inputs `CreatePlanInput`, `CreatePlanNodeInput`, `ConfirmProposalInput`, `ProposedStageInput`, `UpdatePlanInput`, `DeletePlanInput`; payloads `CreatePlanPayload`, `ConfirmProposalPayload`, `UpdatePlanPayload`, `DeletePlanPayload` (Relay-classic plumbing with `clientMutationId`, same convention as register/login). No stray types. The epic-02 surface pin (`spec/graphql/auth_surface_spec.rb`) was updated to the grown MutationType (register/login + the four Plans mutations); the no-logout and minimal-User pins are untouched and still green.

**Repo-diff deviation list (Phase-1 `frontend/src/data/plan-repository.ts` + `plan-queries.ts` + `entities.ts` vs this surface — the kickoff-delta-5 requirement):**

1. **Operation set mirrors the repo exactly:** `getPlan`/`listPlans`/`listNodesByPlan`/`createPlan`/`updatePlan`/`deletePlan` — no node rename/state edits exist in Phase 1, so **no node mutations** land here. Node reads live under the plan detail's `nodes` field (sorted by `order` — the `listNodesByPlan` mirror), covering both `usePlanQuery` and `usePlanNodesQuery`.
2. **"title" in the ticket prose is TS `topic`** — Phase-1 StudyPlan has no title field; the type exposes `topic` (+goal), no `title`.
3. **`visibility` does not exist in the Phase-1 TS shape** — the backend ER has it (FR-38, default private). Exposed as a plain String passthrough on the type + optional arg on create/confirm/update, validated against the enum values server-side (garbage → VALIDATION_FAILED; "private" default). The Square opt-in read path stays epic-11's.
4. **TS `nodeIds` → the `nodes` association** (graph style; the backend realizes the inverse). `materialIds` deliberately not exposed — materials ride ticket 02.
5. **`KnowledgeNode.createdAt` added** (server row timestamp; the TS shape has none) — deviation, cheap and useful for cache eviction. All other fields verbatim (planId/taskId/stage/title/order).
6. **Confirm-proposal payload mirrors `PlanStructureProposal`** (frontend/src/ai/types.ts): stage-grouped `{name, nodeTitles}` + topic/goal; the command flattens stage-then-title with one global order index — exactly `toPlanCreateInput` (creation-mapping.ts) minus the rename map (renames are applied in the UI before confirm; the flattened shape remains available via `createPlan`). The proposal's `language` field is deliberately not carried — a UI concern, nothing to persist it on.
7. **`createPlan` requires a non-empty node list** — the server-side mirror of the mapper's `EMPTY_PLAN_PROPOSAL` refusal (blank topic/node titles/stage names likewise VALIDATION_FAILED).
8. **Node uuids are server-minted at confirm** (Phase-1 mints them client-side via crypto.randomUUID); `CreatePlanNodeInput` carries no id. The plan's `clientUuid` is the aggregate's idempotency key (delta 3): same-user replay → Success + existing rows; uuid owned by a different user → VALIDATION_FAILED (never silently link). Arg named `clientUuid` rather than TS's `id` to avoid confusion with Relay's `clientMutationId`.
9. **deletePlan's cascade is deeper server-side, not narrower:** Phase-1 deletes plan + nodes + materials + readingProgress + chatThreads and leaves quiz/evidence/mistake/flashcard rows dangling (the TS doc tolerates it); the ER's FKs forbid dangling rows, so the command sweeps the full dependent graph (evidence → mistakes → questions → flashcards → annotations → section markings → progress → threads → sessions → nodes → materials → plan) in ONE transaction, every sweep through the owner's association path. A plan-free task triangle and other users' rows are pinned as survivors by spec.
10. **Non-uuid by-id args → uniform NOT_FOUND** (plan query, update, delete pre-validate the shape) — a malformed address must not degrade into an INTERNAL 500 from the uuid column comparison; the answer is indistinguishable from "no such row", which delta 2 wants anyway.
11. **Reads are thin resolver bodies, not commands** (`plans` → `current_user!.study_plans`, `plan` → scoped `find_by` + NOT_FOUND): a bare read has no use-case logic — the scoping IS the logic, via delta 2's exact association path, proven per-op at the HTTP level.
12. **`CurrentUserGuard`** (`app/graphql/current_user_guard.rb`): the epic-02 guard moved verbatim out of `BaseMutation` into a shared module now that the query side needs the same seam (`QueryType` includes it for `plans`/`plan`; delta 8's every-op auth). Wire shape unchanged; `auth_guard_spec` untouched and green. Garbage-token/absent-header behavior identical.

**For ticket 02 (tasks + materials) and later slices:** (a) the `Mutations::Plans::*` file layout + the `::Plans::XCommand` fully-qualified reference — bare `Plans::` inside `Mutations::Plans` lexically resolves to `Mutations::Plans::` (NameError trap hit once here); (b) `CurrentUserGuard` is the query-side auth seam for material list/detail resolvers; (c) deletePlan's cascade sweep order is the reference for any command that removes material-anchored rows; (d) `Plans::PlanCreation` (shared validation + delta-3 idempotency core) is the template if materials need client-uuid creates.

**New tests (45):** `spec/commands/plans/` — create_plan_command_spec (10: happy/order/visibility/default, idempotent replay, cross-user uuid, uuid shape, blank topic, empty nodes, blank node title, invalid visibility, public accepted), confirm_proposal_command_spec (6: stage-then-title flatten, replay, cross-user uuid, no stages, all-empty stages, blank stage name), update_plan_command_spec (8: patch, nil-goal clear, visibility, cross-user NOT_FOUND, unknown id, blank topic, invalid visibility, empty patch), delete_plan_command_spec (5: full-cascade, plan-free survivors, foreign survivors, cross-user NOT_FOUND + nothing deleted, unknown id). `spec/requests/graphql_plans_spec.rb` (16): UNAUTHORIZED on all six ops, plans list own-only via real second user, plan detail + ordered node tree, cross-user plan NOT_FOUND, unknown plan NOT_FOUND, createPlan happy/replay/cross-user-uuid/blank-topic, confirmProposal happy/replay, updatePlan patch + nil-goal clear/absent-untouched/cross-user NOT_FOUND, deletePlan happy cascade/cross-user NOT_FOUND.
