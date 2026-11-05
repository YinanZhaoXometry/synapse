# Phase 2 roadmap — the full board

Status: planned (all epics spec'd + ticketed 2026-11-03, one batch pass under the standing decide-all delegation)
Milestone: Phase 2 — post-deadline

This file is the phase-level index over `.scratch/phase-2/epic-*/`. Epics stay authoritative for their own scope; this file owns the **sequence story**: what blocks what, what runs in parallel, where the owner has human-side work. The spine ([architecture-synapse.md](../../docs/architecture/architecture-synapse/architecture-synapse.md), AD-12…20) is the decision source; the PRD ([prd-synapse.md](../../docs/product/prd-synapse/prd-synapse.md) §6.2) is the scope source.

**Convention note:** workflow.md's "create the epic doc when its spec run starts — never pre-file empty shells" is honored in spirit: every epic below carries a real spec + tickets, not a shell. What is *deferred* to each epic's kickoff is a **delta review** (light grill re-check of that spec's open assumptions) — not a re-run of the chain. Backend epics 01–08 are grounded in the final spine; feature epics 09–14 are grounded in the final PRD + UX spines and each carry an explicit "delta-grill at kickoff" line.

## The board

| # | Epic | Scope (FRs / ADs) | Gate (must be done first) | On critical path |
| --- | --- | --- | --- | --- |
| 00 | [monorepo](epic-00-monorepo/epic.md) *(done 2026-11-03 — branch epic/p2-0-monorepo @ 96eb1ea, merged to main same day)* | `frontend/` + `backend/` + justfile + CI (AD-17; folders renamed from `web/`+`api/` 2026-11-04) | — | ✅ |
| 01 | [api-foundation](epic-01-api-foundation/epic.md) *(done 2026-11-04 — branch epic/p2-1-api-foundation @ c0c89b0, CI 41690050139, merged to main same day)* | command core, closed error enum, full ER + migrations, scoping RSpec (AD-12/13) | 00 | ✅ |
| 02 | [auth](epic-02-auth/epic.md) *(done 2026-11-04 — branch epic/p2-2-auth @ 8cbfc47, CI 41706564212, merged to main same day)* | bcrypt + JWT, register/login, `current_user` context, demo seed (AD-15, FR-30) | 01 | ✅ |
| 03 | [domain-ops](epic-03-domain-ops/epic.md) *(done 2026-11-04 — branch epic/p2-3-domain-ops @ c9ebcdc, merged to main same day)* | GraphQL read/mutation surface for the whole Phase-1 data model (AD-12/13) | 01, 02 | ✅ |
| 04 | [mastery-ruby](epic-04-mastery-ruby/epic.md) *(done 2026-11-04 — branch epic/p2-4-mastery @ efde453, merged to main same day)* | golden vectors, Ruby port, server scores + streak (AD-14/6, FR-3/20) | 01 | cutover blocker, parallel lane |
| 05 | [ai-server](epic-05-ai-server/epic.md) | provider adapter, AI mutations, SSE + tickets, cost cap (AD-16/5, FR-33/34) | 01, 02, 03 | ✅ |
| 06 | [storage-r2](epic-06-storage-r2/epic.md) | ActiveStorage→R2, presign, minio (AD-13/20) | 01 | cutover blocker, parallel lane |
| 07 | [requeue](epic-07-requeue/epic.md) | Solid Queue, FR-24 due-scan (AD-19) | 01, 03 | ❌ (not needed for cutover) |
| 08 | [cutover](epic-08-cutover/epic.md) | Apollo 4, login wall, import, SSE client, retirement, deploy (AD-18/15/20/16-web) — **SHIPPED 2026-11-05 — all six tickets done, merged to main** (owner-approved merge-order amendment: live-stack ACs + rollback rehearsal moved post-merge, after provisioning per deploy.md §2) | 02, 03, 04, 05, 06 | ✅ — the merge point |
| 09 | [hubs-progress](epic-09-hubs-progress/epic.md) *(done 2026-11-05 — branch epic/p2-09-hubs, 6 tickets + two-axis reviews, merged to main)* | Mistakes/Today/Flashcards/Quiz hubs, Analytics, Achievements, Dashboard re-point, weekly goal (FR-23/26/27/28/41/42, FR-25 P2 halves) | 07, 08 | ✅ |
| 10 | [nodes](epic-10-nodes/epic.md) *(done 2026-11-05 — branch epic/p2-10-nodes, 5 tickets + two-axis reviews + fixes, merged to main)* | material–node mapping, node-pinned attach, node states, roadmap graph, adaptive targeting (FR-5/6/7/21/44/45) | 08 | ✅ |
| 11 | [square-import](epic-11-square-import/epic.md) *(done 2026-11-05 — T1–T3 merged to main; T4 roadmap.sh import = wontfix by owner decision 2026-11-06 — license forbids republishing, owner declines to seek consent; FR-43 dropped)* | visibility, Square read + fork, roadmap.sh import (FR-38/39/43) | 08 | ✅ |
| 12 | [notes-plan-companion](epic-12-notes-plan-companion/epic.md) *(done 2026-11-05 — branch epic/p2-12-notes, 3 tickets + two-axis reviews, merged to main)* | Notes + enrichment, weak-spot Notes, plan-level Companion (FR-40/22/46) | 08, 10 | ✅ |
| 13 | [reader-depth](epic-13-reader-depth/epic.md) *(done 2026-11-05 — branch epic/p2-13-reader, 5 tickets + two-axis reviews, merged to main)* | selection shortcuts, Quick Test, Annotations, Study Focus, PPT upload (FR-13/14/16/17, PPT) | 08 | ✅ |
| 14 | [small-tail](epic-14-small-tail/epic.md) *(done 2026-11-05 — branch epic/p2-14-tail, 3 tickets + inline two-axis reviews, merged to main; T3 = registry/checklist — all four ops items trigger-recorded, owner-gated; closes Phase 2)* | Settings account surfaces, Task→Plan promotion, ops hardening (deferred-table tail) | 08 | ✅ |
| 15 | [marking-ui](epic-15-marking-ui/epic.md) *(done 2026-11-06 — night run, 3 tickets + two-axis reviews, live smoke PASS; the §6.2 diff-check's FR-15 survivor consumed — placement decided under the standing decide-all delegation)* | FR-15 Mastery Marking UI: sectionMarkings read query (the missing server half), web seam (hooks over the dormant domain type), reader claim/unmark + green + confirm-quiz launcher | 08 | — (post-board delta epic) |

Cross-epic edges are recorded here and on each epic.md's **Gate** line (the ticket-level `Blocked by:` convention stays intra-epic). A gate means: do not start the epic's tickets until the gated epics are `done` on their trackers.

## Blockers vs non-blockers

**Hard sequence (each gates everything behind it):** 00 → 01 → 02 → 03 → 05 → 08 → features. Nothing on this chain can be skipped, reordered, or parallelized away: 01 needs the monorepo's `backend/` home; 02–07 all build on 01's models/commands; 05 needs auth'd context + domain ops to persist into; 08 turns the whole server on; every feature epic consumes post-cutover web.

**Blockers for the cutover only (parallelizable):** 04 (mastery port) and 06 (storage). Both hang off 01 alone, run in their own lanes, and must merely *finish* before 08 starts.

**Not blockers anywhere:**
- 07 (re-queue) — server-side scheduled work; the cutover does not need it. It must land before **09** (the Today hub renders due reviews), so its true deadline is "before hubs", not "before cutover".
- 09–14 — post-cutover features; none blocks another except 10 → 12 (FR-46 grounding needs 10's section→node mapping).
- 13's PPT ticket is the designated lane-filler: it is client-side parsing (AD-7 extension) with no server dependency — it can run any time after 00, even pre-cutover.

## Parallelism

**After 00 lands (landed + merged to main 2026-11-03): single lane.** Only 01. (Owner-parallel: CF Pages initial configuration, root `frontend` — no re-point step, see deploy.md.)

**After 01 lands: three lanes.**
- Lane A: 02 auth → then 03 domain-ops (fine-grained overlap allowed: 03's command-level tickets may start against 02's branch-point models once 02's users table shape is stable — coordinate, don't race migrations).
- Lane B: 04 mastery-ruby (golden-vector script even earlier — it lives in `frontend/` and only needs the Phase-1 suite).
- Lane C: 06 storage-r2 (its owner ticket — R2 bucket + credentials — can be done any time from now; the code needs only 01).

**After 02+03 land: two more lanes open.** 05 ai-server (critical path) ∥ 07 requeue; lanes B/C continue if unfinished.

**08 cutover: single lane, merge point.** Everything above must be done. It is worked as one integration branch with two-axis review — do not parallelize inside it except the deploy ticket's owner-side provisioning (Render/Neon/R2 accounts), which should be provisioned *while* 05 is in flight.

**After 08 lands: wide open.** 10 ∥ 11 ∥ 13 ∥ 14 immediately; 07 too if still pending; 09 when 07 is done; 12 after 10. Two-builder maximum is the practical constraint, not the graph — pick by risk (10 is the biggest, start it first).

## Owner-side (ready-for-human) items, by window

| When | Item | Feeds |
| --- | --- | --- |
| any time | CF Pages initial configuration (root `frontend` — Pages not yet deployed; folder renamed from `web` 2026-11-04; no re-point step) | epic-00 close-out |
| any time | R2 bucket + access token | 06-T3 |
| before 05-T1 | GLM provider terms verification (OQ-4 gate) | 05 |
| any time (now post-epic-08-merge) | Render + Neon accounts, env values → provision per deploy.md §2, then live ACs + rollback rehearsal | 08 close-out (post-merge) |
| before a graded demo | Render/Neon paid upgrade for the demo window (AD-20) | ops |
| before real users | mail provider (unblocks password reset), Neon backups | 14 |

## Phase-2 kickoff checklist (started 2026-11-03)

1. Implement epic-00 (the only pre-spec'd epic — its tickets are already `ready-for-agent`). — **done 2026-11-03**, merged to `main` at owner direction.
2. Run the **PRD §6.2 ↔ 落地 diff check** (carry-over from the final-system prototype audit, 2026-11-03): walk §6.2's deferred list against what actually shipped in Phase 1; reconcile any drift into the epics below before opening them. Known from that audit: the only true product gaps were FR-44/45 — both now epic-10 tickets. — **re-run 2026-11-05 at epic-14 close** (the final roadmap item): 10 of 14 §6.2 lines shipped clean across Phase 2; 4 survivors reconciled to the spine Deferred table with fresh triggers (FR-43 license consent · FR-15 web marking UI · MaterialsPage demo data · hub state-field tails). Walk table: [epic-14 epic.md](epic-14-small-tail/epic.md).
3. Open epic-01; schedule lanes per the table above.
4. Delta-review each feature epic (09–14) at its own kickoff, not before — assumptions age.
