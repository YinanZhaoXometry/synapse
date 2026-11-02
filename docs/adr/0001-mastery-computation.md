---
status: accepted
date: 2026-11-02
---

# Mastery Score computation: windowed evidence mean with a minimum-evidence gate

Resolves OQ-9 for the static-first build (placement was already fixed by architecture AD-6: one pure function in `domain/mastery.ts`). Each quiz answer becomes an EvidenceRecord with an outcome value — correct 1, partial 0.5, wrong/forfeit 0. A node's score is the mean of its **last 5 outcomes** ×100, **capped at 99 until the node has ≥3 total evidence records**; the **mastered** state requires score ≥80 **and** ≥3 total evidence records (anti-inflation, SM-C2: one lucky answer cannot green a node). Plan rollup = mean of node scores with uncovered nodes counting 0 — because of the cap, 100% is reachable only when every node is genuinely mastered (the UX display contract, AD-6); a Study Task's single node shows its own score.

**Amendment 2026-11-02 (caught by TDD against AD-6's readiness invariant):** the original formula — plain mean-of-last-5 — let a node *score* 100 with only 1–2 records (the gate gated the state, not the score), so a plan rollup could hit 100% while nodes sat in `partial`. The gate now caps the score itself: below 3 evidence records a node displays at most 99%. A perfect-but-unverified node reads 99% — honest by design ("one more verified round"); 100 anywhere means verified mastery.

## Considered Options

- **Lifetime mean** (all outcomes, equal weight): rejected — one early wrong answer caps a node below 100 forever; punishes learning.
- **Share-of-mastered-nodes rollup**: rejected — moves in 1/N steps and collapses a single-node Study Task to 0/50/100.
- **Ungated score with a display-layer 100% clamp**: rejected — the contract belongs in the one pure function (AD-6), not re-implemented per surface; a task-level rollup would still show 100% on an un-gated node.
- **Time-based decay (NFR-8 freshness)**: deferred to Phase 2 — the last-5 window already ages evidence; the amber freshness ring layers on top without touching this formula.

## Consequences

- All constants live in one exported `MASTERY_CONFIG` (window 5, gate 3, threshold 80, partial value 0.5) — tuning is a one-line change with no shape migration.
- EvidenceRecords carry timestamps and node attribution (AD-6) so the window and the Phase-2 freshness layer both work from stored data.
- Phase-1 evidence sources: quiz answers only; flashcard self-ratings never create EvidenceRecords.
- Partial state spans 1–99 with the gate unmet or score <80; a 99% node is the normal "perfect but unverified" state.
