# Epic 31 — adaptive-review

Milestone: Phase 4 — learning-engine season
Status: ready-for-agent
Spec: [spec.md](spec.md) · Design source: [../deeptutor-comparison.md](../deeptutor-comparison.md) §3.6-3.8 · Board row: [../roadmap.md](../roadmap.md)

## Scope

Requeue upgraded **in place** (one scheduler — the anti-sprawl ruling from the DeepTutor comparison): geometric interval growth for mistakes, per-difficulty geometric ladders with a stage counter for flashcards, a same-day anti-grind guard, mistake-first due ordering, resolved-mistake re-open on wrong review, and an Anki export tail ticket. Correct-on-wake (AD-19) is untouched — the derivation *rules* change, the purity does not.

## Non-goals (grill-confirmed rejections)

- Any retrieval/FSRS model, `desired_retention` setting, or review-strategy presets — the discrete ladder IS the posture (comparison §3.7: "their mistake" was scheduler sprawl; we keep exactly one).
- ADR-0001 changes — flashcard ratings stay non-evidence; no amendment owed by this epic (29/30 carry those).
- New scheduler state tables — the schedule stays a correct-on-wake cache; the only new persisted state is one integer column on flashcards.

## Delta-grill (self-answered under the standing delegation, 2026-11-11)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | SM-2 ease is stateful; AD-19 re-derives everything from source rows. Conflict? | None in effect: stage (consecutive corrects) is the derivable streak. Upgrade the *ladder shape* to geometric growth — equivalent to ease≈2 SM-2 with zero new state. |
| Q2 | Same-day grinding (rapid retakes fill the ladder in one session)? | Adopt DeepTutor's same-session guard discretized: stage advance requires the two latest relevant events on different UTC days. |
| Q3 | Forgetting-risk ordering (DeepTutor `1−retrievability+…`)? | Discretize, don't model: keep `next_due_at ASC`, tie-break mistakes before flashcards (the active-error bonus, ordinal form). |
| Q4 | Do resolved mistakes keep being scheduled? | Yes (review is anti-forgetting, not just repair — scan keeps ignoring `resolved`), but a wrong/partial review re-opens them (`resolved → false`, hub resurfaces). |
| Q5 | Anki export shape? | GraphQL query returning the TSV string (deck per material, FR-41's deck concept), GUID = content hash → update-not-duplicate; client Blob download. |
| Q6 | Anything else from DeepTutor's scheduler? | No — forgetting_risk numbers, retention settings, presets: parked (phase-4 board parking lot). |
| Q7 (T2 pre-implementation amendment, 2026-11-11) | The (difficulty, stage) lookup restarts each ladder at its base — a hard→easy transition would jump 2d → 20d off ONE easy rating (interval continuity lost, unlike SM-2's ease-on-current-interval). | **Easy climbs only on a streak**: an easy rating advances the stage only when the previous rating was also easy (the first easy after anything else sits at the base rung); medium holds the stage; hard resets. Verified cliff-free: hard→easy 2d→10d, easy×2→medium 20d→14d, medium→easy 10d. |
