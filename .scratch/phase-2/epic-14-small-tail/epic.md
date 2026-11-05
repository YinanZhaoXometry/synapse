# Epic 14 (Phase 2) — Small tail: Settings account surfaces, Task→Plan promotion, ops hardening

Status: done (2026-11-05 — all three tickets done + inline two-axis reviews, merged to main; rspec 1285 / vitest 807 at the tip; T3 = registry/checklist disposition per delta decision 3 — all four ops items external-dep, trigger-recorded in ticket 03's registry + deploy.md §11 checklist; Phase-2 §6.2 diff check re-run at close)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-37 stretch half, FR-30/34 surfaces ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · EXPERIENCE "later" Settings list · spine **AD-15** (account mechanics), **AD-16** (cap counter), **AD-20** (demo-window posture) · Deferred-table ops rows · [spec.md](spec.md). Closes Phase 2.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-settings-account.md](issues/01-settings-account.md) | — (epic gate) | password change, data export (import-shaped), cap display, weekly-goal set |
| 2 | [02-task-plan-promotion.md](issues/02-task-plan-promotion.md) | — (parallel) | promote Study Task → Study Plan, evidence continuity (FR-37 stretch) |
| 3 | [03-ops-hardening-registry.md](issues/03-ops-hardening-registry.md) | — (parallel) | error visibility (demo window), Neon backups decision, password-reset mail gate, OAuth registry |

## Definition of done

All four Settings surfaces live · promotion preserves scores/evidence (spec-proven) · every T3 registry item shipped or trigger-recorded · gates green · **Phase-2 §6.2 diff check re-run at close** (roadmap final item).

## Coordination notes

- **Gate: epic-08 done**; fully parallelizable with 09–13 (small, low-collision).
- Export shape pairs with epic-08-T3's import — shape changes go through both tickets' Comments.
- Closing this epic + the diff check = Phase 2 feature-complete; anything surviving goes back to the spine's Deferred table with fresh triggers.

## Kickoff delta review — 2026-11-05 (decide-all delegation)

1. **Export size posture:** the export gathers the WHOLE user document in epic-08-T3's import shape with no artificial size cap — the import's bounds (≤100k chars/section, delta 6) are the importer's concern; the export download ships what exists. Streamed as one JSON blob via a signed download-style payload (the presign posture is for R2 bytes; the export rides a normal authenticated GraphQL payload → client-side Blob download, the T5-of-epic-13 export precedent at plan scale).
2. **Password change:** verify-old → bcrypt-new (min length = the register command's rule), rate-limited through the login limiter's pattern, sessions survive (stateless JWT — the AD-15 policy stated in the schema description; no revocation list exists or is built).
3. **T3 disposition (the registry ticket):** all four items carry EXTERNAL dependencies (Render paid tier/log drain, Neon console, mail provider, Google console) — none is agent-buildable end-to-end. T3 ships: the registry table (item/trigger/status/date) in the ticket Comments + the demo-window checklist section in `docs/deploy.md` + whatever zero-dependency code each item implies (NONE found on recon — password reset needs the mailer; OAuth needs the console). T3 therefore lands as docs/registry + owner-list feed; every item trigger-recorded. This satisfies the ticket's own AC ("each item resolves to done or a recorded trigger").
4. **T2 promotion shape:** `study_tasks.promoted_plan_id` nullable column + `promoteTaskToPlan` command — the task's node keeps its id and gains plan_id (evidence untouched — ids stable), the material re-points plan-wide, the task row flips to the pointer state (a `promoted` boolean or inferred from promoted_plan_id — PICK inferred: non-null promoted_plan_id = promoted; the task page renders the pointer honestly). Idempotent on clientUuid per the house law.
