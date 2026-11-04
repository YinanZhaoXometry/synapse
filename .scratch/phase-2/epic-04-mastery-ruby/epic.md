# Epic 4 (Phase 2) — Mastery moves home: golden vectors, the Ruby port, server scores

Status: done (2026-11-04 — branch epic/p2-4-mastery @ efde453, two-axis review 2P1/6P2 all fixed, 568/568 rspec + 421 web tests, CI green, merged to main same day)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane B · spine **AD-14** (Ruby at cutover, golden vectors, client renders never recomputes), **AD-6** (one pure implementation), [ADR-0001](../../../docs/adr/0001-mastery-computation.md) verbatim · FR-3/20, SM-3/C2/C3 · [spec.md](spec.md). Must land before epic-08; parallel with 02/03/06.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-golden-vectors.md](issues/01-golden-vectors.md) | — (epic-00 enough) | TS generator script → committed fixture JSON, boundaries both directions |
| 2 | [02-ruby-mastery.md](issues/02-ruby-mastery.md) | 1 (fixture shape), epic-01 | `Mastery` module, RSpec exact-equality on fixtures |
| 3 | [03-scores-on-the-wire.md](issues/03-scores-on-the-wire.md) | 2, epic-03 types | score/streak resolver bodies on KnowledgeNode/StudyPlan |
| 4 | [04-freshness-decay.md](issues/04-freshness-decay.md) | 2 | NFR-8 decay: ADR-0001 amendment + vectors + both-side agreement (separable, may slip) |

## Definition of done

RSpec fixture parity exact · boundaries covered both directions · CI anti-drift diff green until cutover · score fields answer on the wire via factory graphs · every ticket cites AD-14/AD-6 · rubocop+rspec green.

## Coordination notes

- **Lane B:** runs parallel with 02 (auth) and 06 (storage) after 01; ticket 1 can even start right after epic-00 (it lives in web's scripts/).
- **Epic-03 coordination:** field placement decision lives in epic-03 ticket 1's Comments; this epic's ticket 3 implements bodies.
- Ticket 4 slipping does not hold the cutover (v1 = no decay); re-gate at epic-09 kickoff.

## Kickoff delta review (2026-11-04, standing decide-all delegation — "全部按推荐")

1. **Ticket 4 decay values (needs-info → standing delegation):** freshness window = **14 days** on the node's LATEST evidence record. Mechanism reuses the existing cap pattern (ADR-0001's own deferred note: "layers on top without touching this formula"): a node whose newest evidence is older than the window **caps its displayed score at 99 and is not mastered** — windowed-mean math untouched, 100%-only-when-every-node-mastered invariant preserved (a decayed node can never certify). `MASTERY_CONFIG` gains `freshnessDays: 14`. Boundary vectors both directions (exactly-14d fresh vs 14d+1s stale), rollup-with-one-decayed-node, interplay with the <3 gate. Rationale: NFR-8's recall cadence + a forgiving study rhythm; FR-24 re-queue resurfaces recall before staleness bites. Owner re-tuning = one config line.
2. **Streak day-boundary (A1):** Phase-1 `computeStreak` uses the BROWSER-LOCAL calendar day (explicit in code, not folklore). AD-14 demands TS↔Ruby agreement, so the golden-vector contract pins **UTC**: `computeStreak` gains an explicit `dayBoundary: "local" | "utc"` option (default `"local"` — Phase-1 behavior unchanged), vectors generate in UTC mode, the Ruby port implements UTC, and the ADR amendment records the boundary + the note that a per-user timezone stays a deferred row (server cannot know browser-local time).
3. **Ticket 1 surface:** `frontend/scripts/generate-mastery-vectors.ts` + a package.json script entry; committed fixture `backend/spec/fixtures/mastery_vectors.json`; CI web job gains a generate-and-diff anti-drift step. Web suite count changes ONLY if ticket 4 lands (both-sides decay); ticket 1 itself changes none.
4. **Ticket 2 placement:** `backend/app/lib/mastery.rb` (the app/lib precedent from Accounts) reading `MASTERY_CONFIG`-equivalent constants; RSpec consumes fixtures with exact string-decimal equality. No scoring logic anywhere else (AGENTS.md convention note).
5. **Ticket 3 fields:** `KnowledgeNodeType.masteryScore` + `.state` (uncovered/partial/mastered), `StudyPlanType.masteryScore` (rollup), root query `streak: Int!` (user-scoped, from all of the user's evidence) — per epic-03 ticket-1's recorded placement decision (epic-04 owns bodies). StudyTask needs no own field: its single node's score IS the task rollup (ADR consequence verbatim). Schema movement rides the codegen proof.
6. **Rounding:** whatever `domain/mastery.ts` does is verbatim (rounding mode + operation order pinned in the fixture metadata); any ambiguity surfaces → amend ADR-0001 first, both sides together — never a quiet divergence (AD-14).
