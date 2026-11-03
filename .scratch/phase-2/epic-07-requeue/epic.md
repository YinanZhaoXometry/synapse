# Epic 7 (Phase 2) — Re-queue: Solid Queue + the FR-24 due-scan

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epics 01+03 done; **not a cutover blocker** — hard deadline is epic-09)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · spine **AD-19** (Solid Queue in-process, direct Neon URL, no keep-alive, correct-on-wake, no unnamed jobs) · FR-24 (+FR-23's "re-queue pulls due items") · OQ-6's revisit lands here · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-solid-queue-install.md](issues/01-solid-queue-install.md) | — (epic gate) | gem + in-process supervisor + direct-URL posture + recurring scaffold |
| 2 | [02-due-scan-algorithm.md](issues/02-due-scan-algorithm.md) | 1 | scheduling model + intervals (values at kickoff), correct-on-wake scan |
| 3 | [03-due-surface.md](issues/03-due-surface.md) | 2 | `dueItems` query + dev/demo force-due trigger |

## Definition of done

Scan recomputes due-ness on wake with no backlog inflation · wrong-sooner ordering proven by Timecop specs · recurring job calls one command · no keep-alive anywhere (grep-guard) · `dueItems` answers for epic-09 · rubocop+rspec green · every ticket cites AD-19.

## Coordination notes

- **Gate: epics 01+03 done.** Parallel with epic-05; may even slip past the cutover — **epic-09 is the hard consumer** (roadmap gate).
- Ticket 1's runtime shape (in-process supervisor, direct URL) is exactly what epic-08's deploy ticket boots in prod — land it before or with 08-T6, or 08-T6 configures it independently (flagged there).
- Interval values + ER delta recorded in ticket 2 Comments; epic-04's decay ticket (if landed) reconciles against them.
