# 02: Study Task → Study Plan promotion (FR-37 stretch half)

**What to build:** one transactional promotion command: the task's single auto-node becomes the plan's first node, its material attaches plan-wide, evidence carries over untouched (node ids stable — only plan linkage changes, scores unchanged through promotion); the task becomes a read-only pointer to the plan; idempotent on client uuid.

**Blocked by:** None (parallel).

**Status:** done

**Bound by:** FR-37 stretch half, AD-6 (no re-attribution — no second rollup path), AD-12 (one command, one transaction), AD-13 (scoping).

- [x] Score-continuity spec: mastery identical before/after promotion
- [x] Task page renders the promoted pointer; no zombie writable state
- [x] Bilingual flow incl. confirmation copy

## Comments

**Landed 2026-11-05** (branch `epic/p2-14-t02-promotion`, on `epic/p2-14-tail` @ `5e1885c`).

Schema movement: `study_tasks.promoted_plan_id` (uuid, nullable, FK → study_plans, ON DELETE SET NULL, two-step strong_migrations validate) + `promoted_at` (datetime, nullable); `schema.graphql` gains `promoteTaskToPlan` (+ `PromoteTaskToPlanInput/Payload`) and `StudyTask.promotedPlanId/promotedAt/promotedPlan`. Promoted state is INFERRED from the non-null `promoted_plan_id` (delta decision 4) — no boolean.

Findings + decisions (the recon the ticket asked for):

- **Material scope finding:** task materials ALWAYS carry `attachment_scope = "plan"` today — `Materials::AttachMaterialCommand` defaults the scope to "plan" and rejects `scope="node"` for the task triangle ("a task material cannot pin to a plan node"); the column default is also "plan". Promotion therefore leaves the scope field untouched — the plan-scope assembly already includes the re-pointed material.
- **The node xor is convention, not constraint:** `knowledge_nodes.plan_id`/`task_id` carry no DB check (unique task_id only); AD-6's plan-or-task law is enforced by the command (one `update!` flips both together).
- **StudyTask carries no title of its own** — the task's displayed title IS the material's, so the plan topic defaults to `material.title` (a whitespace-only client topic falls back to the same default).
- **DeletePlanCommand needed a sweep (the one deviation beyond the ticket's literal text):** promotion makes `plan material + materials.task_id null + study_tasks.material_id back-reference` reachable for the first time, and `study_tasks.material_id` is a NOT NULL FK with no on_delete — deleting a promoted plan would have exploded as InvalidForeignKey → INTERNAL. The delete now sweeps the promoted pointer rows and their task-scope sessions inside the same transaction (their evidence/mistakes/questions are already covered by the node/material sweeps — the moved node's id is in the plan's node set). The pointer dies WITH its plan (a read-only pointer with no target is deleted); the FK's SET NULL stays as the honest DB floor.
- **Empty-task refusal:** `study_tasks.material_id`/`node_id` are NOT NULL FKs, so the "task without a node/material" state is unreachable under the schema — the command still carries the guard as schema-drift insurance, pinned by a spec that suspends the FK triggers for the session (`session_replication_role = replica`) to construct the state.
- **Quiz sessions:** old task-scope sessions keep loading after promotion (sessions reference the task, which persists — pinned in the command spec and on the wire). The task's `node_id` is stable, so raw-API task-scope session creation still resolves to the same node; the UI removes every writable entry instead (pointer card replaces the quick tiles; the material row keeps the reader link and drops re-upload/parse-retry).
- **Idempotency at BOTH levels:** same clientUuid → the promoted plan (delta 3); an already-promoted task → the existing pointer whatever uuid rides (nothing is created, so the task-level fact wins).

Gates: rubocop clean (457 files); rspec **1285 examples, 0 failures** (baseline 1265 + 20: 14 command + 5 wire + 1 delete-sweep), fresh `db:drop db:create db:migrate` run; frontend `pnpm install --frozen-lockfile` → codegen → `tsc -b` → eslint (0 errors) → vitest **807 passed** (baseline 805 + 2) → `vite build`. i18n zh/en parity holds (the dictionary parity test covers the new `tasks.*` keys).
