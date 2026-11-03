# 03: `dueItems` query + dev/demo force-due trigger

**What to build:** `dueItems(date)` GraphQL query returning the day's due reviews (mistake entries + flashcards) with their source locations and study-flow links (plan/task/material ids — enough for epic-09's Today hub to deep-link); a dev-only force-due trigger (rake task or dev-gated mutation) so demos show re-queue without waiting days.

**Blocked by:** 2.

**Status:** ready-for-agent

**Bound by:** AD-13 (user-scoped query — scoping context), FR-24/FR-23 (due items pulled from the Notebook/decks), FR-27 (the shape Today consumes — link fields per the FR).

- [ ] Query answers per user, per date; scoping context green
- [ ] Force-due trigger exists dev-only (never prod-exposed — guard asserted)
- [ ] Response shape reviewed against FR-27's task-list pattern; notes in Comments for epic-09
