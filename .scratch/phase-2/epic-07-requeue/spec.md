# Spec: Epic 7 (Phase 2) — Re-queue: Solid Queue + the FR-24 due-scan

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Placement + runtime
> posture are final (AD-19); the **algorithm + intervals are the open item** (OQ-6's revisit trigger =
> "implementation spec" — this file is it, values finalized at kickoff delta review). Gate: epics 01+03
> done. **Not a cutover blocker** — its real deadline is epic-09 (Today hub renders due items).

## Problem Statement

FR-24 promises wrong answers and flashcards resurface on a spaced schedule (wrong answers sooner) — the loop's memory. The runtime posture is pinned by AD-19's cost findings: **Solid Queue in-process with puma** on the same Postgres via Neon's **direct (non-pooled) connection URL**, **no keep-alive loop** (a ping loop would burn Neon's ~191 free compute-hours in ~8 days), cold starts accepted. What's missing is the whole feature: the queue install, the recurring scan, the scheduling algorithm, and the query the Today hub will read.

## Solution

1. **Solid Queue install (ticket 1):** gem + `config.active_job.queue_adapter = :solid_queue`, supervisor in-process with puma (Rails 8 pattern), **direct Neon URL** documented for prod (transaction-mode pooling dislikes its polling — AD-19), recurring-job config scaffold. This also completes the api's final runtime shape for epic-08's deploy.
2. **Algorithm + due-scan (ticket 2):** scheduling model on top of epic-01/03 rows — per-item next-due timestamps **recomputed from timestamps when the service wakes** (correct-on-wake, not accumulated while asleep — AD-19); intervals: wrong answers resurface sooner than flashcards (exact spacing values decided at kickoff delta review and recorded here); the scan is a recurring job calling one command (thin wrapper, AD-12).
3. **Due surface (ticket 3):** `dueItems(date)` query assembling the day's due reviews (mistakes + flashcards) with links into the study flow — the read epic-09's Today hub consumes; manual "due now" trigger for dev/demo.

## User Stories

1. As a learner, the things I got wrong come back sooner than the things I knew, without me scheduling anything.
2. As the Today hub (epic-09), I read one query to render the day's due reviews.
3. As free-tier economics, the queue sleeps with the api and never pings anything to stay awake (AD-19).
4. As a demo operator, I can force-due items so the re-queue shows up in a graded walkthrough.

## Implementation Decisions

- **Correct-on-wake is the correctness rule:** due-ness derives from stored timestamps at evaluation time — the scan never "catches up" missed days retroactively.
- Scheduling state rides existing entities (evidence/mistake/flashcard rows + a due-timestamp column or side table — decided in ticket 2 with the epic-01 ER diff noted in Comments).
- One recurring job (the scan); **no other background work** (AD-19's named-need rule).
- Demo trigger is a dev-only mutation/rake task, never prod-exposed.

## Testing Decisions

- Timecop-style specs: due-timestamp math, wrong-sooner-than-right ordering, wake-after-multi-day-gap correctness (recompute, no backlog inflation), idempotent scan re-runs.
- Job spec: the recurring entry calls the command exactly once per wake.
- Gates: rubocop + rspec; schema grows by `dueItems` only.

## Out of Scope

Today hub UI (09) · adaptive *suggestions* (FR-21 — epic-10; this epic only schedules what exists) · decay values interplay (epic-04 ticket 4 — if both land, the freshness spec reconciles) · any Redis/Sidekiq anything (not adopted, AD-12/19).

## Further Notes

- Assumption A1: intervals start simple (fixed ladders, wrong < flashcard), revisited only with real usage — matches OQ-6's "deferred to implementation spec" spirit; values land in this spec at kickoff.
- **Sequencing freedom:** may run parallel with epic-05 post-03, or even post-cutover — only epic-09 hard-needs it.
