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

## PRD §6.2 ↔ 落地 diff check — re-run 2026-11-05 (epic-14 close, the roadmap's final item)

Walked §6.2's 14 deferred lines against what shipped across Phase 2 (epics 00–14). **10 lines shipped clean; 4 survivors reconciled to the spine Deferred table with fresh triggers** (edits committed to `docs/architecture/architecture-synapse/architecture-synapse.md` this close).

| §6.2 line | Verdict |
| --- | --- |
| Accounts, plan privacy, sync (FR-4/30/31) | ✅ shipped — auth (epic-02), visibility (11-T1), sync = import + server persistence (08-T3); **OAuth half of FR-30 = survivor** (trigger "a real user asks", T3 registry row 4) |
| Roadmap graph + node states (FR-5/6/7) | ✅ shipped — epic-10 (SVG stage-column renderer per OQ-2, node states) |
| roadmap.sh import, node-pinned attach, mapping (FR-43/44/45) | ✅ FR-44/45 (epic-10); **FR-43 = survivor** — license BLOCK; **resolved 2026-11-06: wontfix** (owner drops FR-43, declines to seek consent — see 11-T4) |
| Square + plan visibility (FR-38/39) | ✅ shipped — epic-11 T1–T3 |
| Notes with enrichment (FR-40) | ✅ shipped — epic-12 (OQ-11 = markers-only v1, recorded) |
| PPT upload (owner Q6) | ✅ shipped — epic-13 T5 (markdown pipeline, zero backend) |
| Adaptive targeting (FR-21) | ✅ shipped — epic-10 (node_scope + targeting xor, weights capped 4) |
| Plan-level Companion grounding (FR-46) | ✅ shipped — epic-12 (plan_companion stream op) |
| In-reader Quick Test + Annotations/Study Focus (FR-13–17) | ✅ FR-13/14/16/17 (epic-13); **FR-15 = survivor** — web marking UI never existed (server ops live, unconsumed); owner placement decision |
| Mistakes Notebook + Re-queue (FR-23/24) | ✅ shipped — epic-07 (requeue) + epic-09 (mistakes hub); **state-field tail survivor**: no resolved/reviewed flag |
| Analytics, Today, badges (FR-26/27/28) | ✅ shipped — epic-09 (real series, Today hub, 12 server-computed badges); **tail survivor**: Today suggestion = heuristic v1 (generation-backed slot awaits) |
| Flashcards Hub + Quiz Hub (FR-41/42) | ✅ shipped — epic-09 T4 |
| Cost cap (FR-34) | ✅ shipped — AI_DAILY_CAP (epic-05) + `aiUsageToday` Settings display (14-T1) |
| Study Task → Plan promotion (FR-37 stretch) | ✅ shipped — 14-T2 (evidence-stable, spec-proven) |

**Survivor disposition (all owner-visible, none agent-buildable):** FR-43 → **wontfix 2026-11-06** (owner drops the import; linking out stays allowed — epic-11 ticket 04) · FR-15 marking-UI placement · MaterialsPage demo data (new Deferred row — the retained hub's server-backing ticket never existed) · hub state-field tails (mistake lifecycle flag + Today's AI-backed slot, one Deferred row). Plus the T3 registry's four ops items (deploy.md §11 checklist + ticket 03). **Phase 2 is feature-complete against §6.2; what remains is owner gates only.**
