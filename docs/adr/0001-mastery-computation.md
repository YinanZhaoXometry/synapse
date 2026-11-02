---
status: accepted
date: 2026-11-02
---

# Mastery Score computation: windowed evidence mean with a minimum-evidence gate

Resolves OQ-9 for the static-first build (placement was already fixed by architecture AD-6: one pure function in `domain/mastery.ts`). Each quiz answer becomes an EvidenceRecord with an outcome value — correct 1, partial 0.5, wrong/forfeit 0. A node's score is the mean of its **last 5 outcomes** ×100; the **mastered** state requires score ≥80 **and** ≥3 total evidence records (anti-inflation, SM-C2: one lucky answer cannot green a node). Plan rollup = mean of node scores with uncovered nodes counting 0 — 100% is reachable only when every node's recent evidence is perfect, which satisfies the UX display contract ("100% only when every node is mastered"); a Study Task's single node shows its own score.

## Considered Options

- **Lifetime mean** (all outcomes, equal weight): rejected — one early wrong answer caps a node below 100 forever; punishes learning.
- **Share-of-mastered-nodes rollup**: rejected — moves in 1/N steps and collapses a single-node Study Task to 0/50/100.
- **Time-based decay (NFR-8 freshness)**: deferred to Phase 2 — the last-5 window already ages evidence; the amber freshness ring layers on top without touching this formula.

## Consequences

- All constants live in one exported `MASTERY_CONFIG` (window 5, gate 3, threshold 80, partial value 0.5) — tuning is a one-line change with no shape migration.
- EvidenceRecords carry timestamps and node attribution (AD-6) so the window and the Phase-2 freshness layer both work from stored data.
- Phase-1 evidence sources: quiz answers only; flashcard self-ratings never create EvidenceRecords.
