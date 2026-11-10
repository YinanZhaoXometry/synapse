# 02: Flashcard stage column + per-difficulty geometric ladders

**What to build:** A flashcard's review interval now grows with demonstrated recall: each difficulty has its own geometric ladder — hard [2, 4, 7] / medium [5, 10, 14] / easy [10, 20, 30] days — and the card's `stage` (persisted, maintained by the self-rating mutation: easy +1, hard reset to 0, medium hold) picks the rung. Rating easy on different days climbs the ladder; rating easy twice in one UTC day climbs once; rating hard sends the card back to rung 0. Unrated cards stay due immediately. The Today wire's flashcard items carry the real stage (the "flashcards stay 0" contract text is updated in the same change).

**Blocked by:** 01 (shares the scan command file — keep the lane serial; the ladders' table shape mirrors 01's).

**Status:** done (2026-11-11)

- [ ] Migration adds `flashcards.stage` (int, NOT NULL, DEFAULT 0, CHECK ≥ 0) — strong-migrations safe; fresh cards start at 0
- [ ] Per-difficulty geometric ladders live on the Requeue module as day-run tables, indexed by min(stage, len−1); unrated (difficulty nil) = due immediately
- [ ] The self-rating mutation maintains stage exactly: easy +1 (capped at the ladder end), hard → 0, medium unchanged; the same-day guard compares the card's previous rating moment (updated_at read before overwrite) with today UTC
- [ ] The scan derives flashcard due dates from (difficulty, stage) through the table — still a pure recompute, no scheduler state
- [ ] The DueItem stage description text and the GraphQL schema descriptions no longer claim "flashcards stay 0"; schema.graphql regenerated (codegen gate + fixture sweep)
- [ ] Request specs: rating transition matrix (easy/hard/medium × fresh/same-day/cross-day), scan table specs over every (difficulty, stage) rung including caps
- [ ] Gates green: rspec, rubocop, web codegen + tsc + vitest (fixture/type refresh)
