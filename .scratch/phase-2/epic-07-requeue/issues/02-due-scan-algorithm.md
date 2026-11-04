# 02: Scheduling model + the due-scan recurring job (correct-on-wake)

**What to build:** scheduling state over mistakes + flashcards (due-timestamp column or side table — decide against the epic-01 ER, record the diff in Comments); **interval values finalized at this ticket's kickoff** (A1: fixed ladders, wrong-answer ladder shorter than flashcard ladder) and written into this spec; the recurring scan as one command — due-ness **recomputed from timestamps at wake** (never accumulated while asleep), wrong answers resurface sooner; scan re-runs idempotent.

**Blocked by:** 1.

**Status:** done (2026-11-04)

**Bound by:** AD-19 (correct-on-wake; the scan is the named recurring job), FR-24 (spaced; wrong sooner), AD-12 (scan → command, job thin).

- [x] Timecop specs: due math, wrong < flashcard ordering, multi-day sleep → recompute (no backlog inflation), idempotent re-scan — Rails' built-in TimeHelpers (travel_to), no new gem
- [x] Interval values recorded in this file under `## Comments` once decided
- [x] Recurring job wraps the command once per wake (job spec — landed with ticket 01)

## Comments (2026-11-04)

**Interval values (kickoff decision 8, also in spec.md):** mistakes `[1d, 2d, 4d, 7d cap]` — stage = consecutive `correct` evidence for the same question after the mistake (`wrong`/`partial` reset); anchor = newer of the mistake's creation and the latest post-mistake evidence. Flashcards by rating: hard 2d / medium 5d / easy 10d / unrated ⇒ due now; anchor = `updated_at` (the rating write).

**ER delta (one side table, as kickoff decision 7):** `requeue_schedules` — uuid PK, `user_id` FK (two-step validate, house pattern), polymorphic **`schedulable_type`/`schedulable_id`** (the Rails-canonical names — the first draft's `item_type`/`item_id` broke the `belongs_to :schedulable` lookup and was renamed pre-commit), `stage`, `next_due_at` (+ `[user_id, next_due_at]` index for epic-09's Today read), `last_source_timestamp` (audit), unique `[schedulable_type, schedulable_id]` backing the scan's upsert. `schedulable` is model-optional: a source row deleted between scans leaves a prunable row, not a crash.

**Scan mechanics:** one evidence query grouped by question (no N+1); stage capped at the ladder's end BEFORE indexing (the uncapped index was a real INTERNAL crash — caught by the cap spec); upsert_all + in-transaction prune of ghost rows; `created_at` rides the upsert (cache row — `last_source_timestamp` is the audit field). Correct-on-wake pinned by the multi-day-sleep spec (identical rows after 5 sleeping days; due_count stays exactly the fallen-due items).
