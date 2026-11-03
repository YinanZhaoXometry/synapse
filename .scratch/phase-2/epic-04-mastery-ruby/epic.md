# Epic 4 (Phase 2) — Mastery moves home: golden vectors, the Ruby port, server scores

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epic-01 done — ticket 1 needs only epic-00)
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
