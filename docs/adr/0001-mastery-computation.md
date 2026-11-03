---
status: accepted
date: 2026-11-02
---

# Mastery Score computation: windowed evidence mean with a minimum-evidence gate

Resolves OQ-9 for the static-first build (placement was already fixed by architecture AD-6: one pure function in `domain/mastery.ts`). Each quiz answer becomes an EvidenceRecord with an outcome value — correct 1, partial 0.5, wrong/forfeit 0. A node's score is the mean of its **last 5 outcomes** ×100, **capped at 99 until the node has ≥3 total evidence records**; the **mastered** state requires score ≥80 **and** ≥3 total evidence records (anti-inflation, SM-C2: one lucky answer cannot green a node). Plan rollup = mean of node scores with uncovered nodes counting 0 — because of the cap, 100% is reachable only when every node is genuinely mastered (the UX display contract, AD-6); a Study Task's single node shows its own score.

**Amendment 2026-11-02 (caught by TDD against AD-6's readiness invariant):** the original formula — plain mean-of-last-5 — let a node *score* 100 with only 1–2 records (the gate gated the state, not the score), so a plan rollup could hit 100% while nodes sat in `partial`. The gate now caps the score itself: below 3 evidence records a node displays at most 99%. A perfect-but-unverified node reads 99% — honest by design ("one more verified round"); 100 anywhere means verified mastery.

**Amendment 2026-11-04 (epic P2-4 ticket 01 — two postures Phase 1 left implicit, pinned explicitly for the AD-14 golden-vector contract; flagged here rather than smuggled):**
- **Rounding posture:** the implementation rounds with ECMAScript `Math.round` — half toward +∞, so a `x.5` tie rounds **up** (37.5 → 38; 99.5 → 100) — applied **once per level**, in this operation order: node score = sum windowed outcome values → divide by the window length → ×100 → round → apply the <3-evidence 99 cap; plan rollup = sum node scores (uncovered count 0) → divide by node count → round once. Whatever `domain/mastery.ts` does is verbatim (AD-14); any future change amends this ADR first, both sides together.
- **Streak day boundary:** the evidence-day streak's calendar day was implicit Phase-1 browser-local time; it is now an explicit option on `computeStreak` (`dayBoundary: "local" | "utc"`, default `"local"` — Phase-1 behavior unchanged). The **pinned contract is UTC**: golden vectors generate in UTC mode and the Ruby port implements UTC, because a server cannot know a browser's local time; a per-user timezone stays a deferred row.

**Amendment 2026-11-04 (epic P2-4 ticket 02 — the golden vectors exposed a rounding-tie violation of the readiness invariant; resolved per AD-14 by amending this ADR first, then both sides together):** the plan rollup rounded its mean with half-up (`Math.round`), so `Math.round((100+99)/2) = Math.round(99.5) = 100` — and `(n·100−1)/n ≥ 99.5` for every plan size n ≥ 2 — letting a single perfect-but-unverified 99-node display a 100% plan, against this ADR's own "100% is reachable only when every node is genuinely mastered" (ticket 01's vectors flagged it verbatim as `rollup.cap-two-node-tie-reaches-100`; never quietly fixed). The rollup mean is now **floored to the whole percent** (`Math.floor` on the mean of node scores). The floor restores the invariant arithmetically: `(n·100−1)/n` is strictly below 100 for every n, so a plan reads 100 only when every node scores 100 — and a node scores 100 only past the evidence gate (amendment 2026-11-02) — i.e. **rollup 100 ⇔ every node mastered**. Node-level rounding is unchanged (half-up `Math.round`), and so is the operation order; only rollup means with a fractional part ≥ 0.5 move (e.g. `(100+100+0)/3` → 66, `(100+63)/2` → 81), every other rollup is bit-identical. *Alternative considered:* clamping the rollup at 99 unless every node is mastered — rejected: it needs an all-mastered special case evaluated at every read and a second rounding rule next to the node-level half-up; the floor is one rule, monotone in the mean, and needs no special case. The golden vectors were regenerated with the floored tie (`rollup.cap-two-node-tie-floors-below-100` → 99).

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
- Plan rollups **floor** (amendment 2026-11-04): a 100% plan display arithmetically requires every node to score 100 — one unverified 99-node holds the plan at ≤99, so the readiness ring can never green on unverified evidence.
