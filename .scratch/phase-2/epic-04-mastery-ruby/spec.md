# Spec: Epic 4 (Phase 2) — Mastery moves home: golden vectors, the Ruby port, server scores

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> AD-14/6 + ADR-0001 (amended). One separable open item (freshness/decay values — ticket 4, NFR-8).
> Gate: epic-01 done. Runs as lane B, parallel with 02/03/06; must land before 08.

## Problem Statement

AD-6 exists so the Mastery Score means one thing; the cutover would create two live implementations (TS in web, Ruby in api) with nothing proving they agree — the exact drift the AD forbids. The port must carry ADR-0001 **verbatim** (last-5 windowed mean; correct 1 / partial 0.5 / wrong-or-forfeit 0; mastered ≥80 & ≥3; <3 evidence caps node score at 99; rollup = mean-of-scores, 100% only when every node is mastered) plus the streak's consecutive-evidence-days rollup — and the proof must be mechanical, not a re-read.

## Solution

1. **Golden vectors (ticket 1, can start any time after 00 — lives in web):** a TS script generating fixture JSON from the existing `domain/mastery.ts` test corpus — every boundary in both directions (79/80, 2/3 evidence, 4/5 window edge, rollup-with-uncovered, task-node single rollup), decimals as strings, timestamps timezone-tagged, streak day-boundary policy stated, rounding mode + operation order pinned in ADR-0001's terms. Committed at `backend/spec/fixtures/mastery_vectors.json`.
2. **The Ruby port (ticket 2):** `Mastery` module — node score, plan rollup, task rollup, mastered predicate; RSpec consumes the fixtures with exact-equality comparison.
3. **Scores on the wire (ticket 3):** resolver bodies for the score fields on KnowledgeNode/StudyPlan (placement per epic-03's recorded decision) + the streak rollup; the client renders, never recomputes.
4. **Freshness/decay (ticket 4, separable):** NFR-8's decay rule as an **ADR-0001 amendment** — values, rationale, and vectors extended; may slip independently of the cutover (v1 = no decay, exactly like Phase 1).

## User Stories

1. As the cutover, the Ruby implementation exists and is proven equal to the TS one before any client stops computing locally.
2. As a learner, my score means the same thing the day after the cutover as the day before.
3. As a future maintainer, the vectors regenerate from web's suite until the cutover retires it (AD-14's "runs until cutover").
4. As the streak, my day-boundary policy is pinned in fixtures, not folklore.

## Implementation Decisions

- **Verbatim port, no reinterpretation:** any behavior the vectors expose as ambiguous gets resolved by amending ADR-0001 first, then both sides — never a quiet divergence.
- Vector generation is deterministic (sorted, stable keys) so fixture diffs are reviewable.
- Ticket 3 coordinates with epic-03 (types host the fields; this epic owns the resolver bodies + tests).
- Ticket 4 amends ADR-0001 via `/domain-modeling` conventions (docs/adr/), regenerates vectors, ships both sides' agreement in the same change.

## Testing Decisions

- RSpec exact-equality against fixtures (decimals as strings) — the acceptance bar; both-direction boundaries required coverage.
- One anti-drift spec: regenerate vectors in CI (web job) and diff against the committed fixture until the cutover retires the TS side.
- Gates: rubocop + rspec; web suite untouched (411+ stays green — generation adds a script, not test changes).

## Out of Scope

Client rendering changes (08) · adaptive targeting (10) · re-queue scheduling values (07) · any scoring-rule invention beyond ADR-0001 (amendments only, via ticket 4's process).

## Further Notes

- Assumption A1: streak day-boundary = the Phase-1 implementation's own policy, captured as-is in fixtures (if Phase 1 left it implicit, pin it in ADR-0001 as part of ticket 1 — flagged).
- Ticket 4 is the only open-valued item; the epic closes without it if it slips (re-gate at epic-09 kickoff, whose Analytics surfaces are its first consumer).
