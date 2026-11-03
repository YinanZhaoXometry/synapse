# 02: Scheduling model + the due-scan recurring job (correct-on-wake)

**What to build:** scheduling state over mistakes + flashcards (due-timestamp column or side table — decide against the epic-01 ER, record the diff in Comments); **interval values finalized at this ticket's kickoff** (A1: fixed ladders, wrong-answer ladder shorter than flashcard ladder) and written into this spec; the recurring scan as one command — due-ness **recomputed from timestamps at wake** (never accumulated while asleep), wrong answers resurface sooner; scan re-runs idempotent.

**Blocked by:** 1.

**Status:** ready-for-agent (interval values = kickoff delta-review item)

**Bound by:** AD-19 (correct-on-wake; the scan is the named recurring job), FR-24 (spaced; wrong sooner), AD-12 (scan → command, job thin).

- [ ] Timecop specs: due math, wrong < flashcard ordering, multi-day sleep → recompute (no backlog inflation), idempotent re-scan
- [ ] Interval values recorded in this file under `## Comments` once decided
- [ ] Recurring job wraps the command once per wake (job spec)
