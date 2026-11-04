# Epic 7 (Phase 2) — Re-queue: Solid Queue + the FR-24 due-scan

Status: ready-for-agent → kickoff done 2026-11-04 (delta review below; standing decide-all delegation — "全部按推荐")
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · spine **AD-19** (Solid Queue in-process, direct Neon URL, no keep-alive, correct-on-wake, no unnamed jobs) · FR-24 (+FR-23's "re-queue pulls due items") · OQ-6's revisit lands here · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-solid-queue-install.md](issues/01-solid-queue-install.md) | — (epic gate) | gem + in-process supervisor + direct-URL posture + recurring scaffold |
| 2 | [02-due-scan-algorithm.md](issues/02-due-scan-algorithm.md) | 1 | scheduling model + intervals (values at kickoff), correct-on-wake scan |
| 3 | [03-due-surface.md](issues/03-due-surface.md) | 2 | `dueItems` query + dev/demo force-due trigger |

## Definition of done

Scan recomputes due-ness on wake with no backlog inflation · wrong-sooner ordering proven by Timecop specs · recurring job calls one command · no keep-alive anywhere (grep-guard) · `dueItems` answers for epic-09 · rubocop+rspec green · every ticket cites AD-19.

## Coordination notes

- **Gate: epics 01+03 done.** Parallel with epic-05; may even slip past the cutover — **epic-09 is the hard consumer** (roadmap gate).
- Ticket 1's runtime shape (in-process supervisor, direct URL) is exactly what epic-08's deploy ticket boots in prod — land it before or with 08-T6, or 08-T6 configures it independently (flagged there).
- Interval values + ER delta recorded in ticket 2 Comments; epic-04's decay ticket (if landed) reconciles against them.

## Kickoff delta review (2026-11-04, standing decide-all delegation)

1. **Gem:** `solid_queue ~> 1.7.2` (current stable verified on rubygems.org; floor-pin per the stack-table posture, exact in the lockfile). No Sidekiq/Redis (AD-12/19).
2. **Adapter config:** `config.active_job.queue_adapter = :solid_queue` in **development.rb + production.rb only** — test env keeps `:test`: the recurring supervisor must never boot under rspec, and job specs drive `#perform` directly (AD-10 direct testing).
3. **In-process supervisor:** puma's `plugin :solid_queue` in `config/puma.rb`, gated on `ENV["SOLID_QUEUE_IN_PUMA"]` (the gem's own convention — unset ⇒ plugin no-ops). Compose dev sets it; production runs puma with it set (deploy doc note). No separate worker service (AD-19).
4. **Queue DB:** the app's own Postgres via `DATABASE_URL` — no `connects_to` split. The **Neon direct (non-pooled) URL** is a deploy-time fact (its polling dislikes transaction pooling, AD-19): documented in backend/AGENTS.md + docs/deploy.md, nothing to code.
5. **Recurring cadence:** `due_scan` **every 10 minutes** (fugit syntax in `config/recurring.yml`). Cost framing: this is polling while the process is already awake (a handful of queries per wake — negligible); the AD-19 cost hazard is keep-alive pinging to defeat cold starts, which stays forbidden (grep-guard).
6. **The scan job is real from ticket 1:** `app/jobs/requeue/scan_job.rb` → `Requeue::ScanJob` wrapping `Requeue::ScanDueItemsCommand` — no throwaway smoke job (AD-19's named-need rule); ticket 1 lands the command as a stub returning an empty set, ticket 2 fills the algorithm. The recurring entry points at it from the start, so the shape never changes.
7. **Scheduling state = one side table (T2's ER delta):** `requeue_schedules` (uuid PK, `user_id` FK, polymorphic `schedulable` → MistakeEntry | Flashcard, `stage` int, `next_due_at` indexed, `last_source_timestamp` for audit) with a unique `[item_type, item_id]` index. Deliberately NOT columns on the two entities: one mechanism, no ER sprawl, and epic-10's adaptive scheduling gets a home. **Correct-on-wake:** the scan always recomputes `stage` + `next_due_at` from source rows' timestamps (`requeue_schedules` is a materialized view of derivable state, refreshed every wake — never accumulated while asleep). Multi-day sleep ⇒ recompute, no backlog inflation (Timecop-pinned).
8. **Interval values (A1 fixed ladders, recorded here + spec.md):** mistakes — stage ladder `[1d, 2d, 4d, 7d cap]` where stage = consecutive `correct` evidence_records for the same question after the mistake's creation (`wrong`/`partial` reset to 0); flashcards — by difficulty rating: hard 2d, medium 5d, easy 10d, unrated ⇒ due immediately. Wrong-sooner holds at every stage: the mistake ladder's floor (1d) beats the flashcard ladder's floor (2d) and its cap (7d) beats easy's 10d.
9. **dueItems read posture (T3):** the Today hub reads the materialized side table through the owner's scope — a **sanctioned bare read** (resolver body, no command; scoping IS the logic), `date` defaulting to now with the **UTC day boundary** (the streak's convention, epic-04). Force-due trigger: a rake task `requeue:force_due`, guarded to development/test (raises in production) — the rake form needs no schema surface.
