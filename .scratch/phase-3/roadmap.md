# Phase 3 roadmap — the optimization season board

Status: planned (opened 2026-11-06; first epic spec'd + ticketed under the standing decide-all delegation)
Milestone: Phase 3 — optimization season

This file is the phase-level index over `.scratch/phase-3/epic-*/`. Phase 3 is the post-deadline
optimization season: no new PRD scope — upgrades to what shipped in Phases 1–2 (FR-5 graph quality
first, per owner direction 2026-11-06). Epics stay authoritative for their own scope; this file
owns the sequence story and the parking lot.

## The board

| # | Epic | Scope | Gate (must be done first) | State |
| --- | --- | --- | --- | --- |
| 16 | [interactive-roadmap](epic-16-interactive-roadmap/epic.md) | roadmap.sh-grade reading mode: real prerequisite edges (AI-expressed, server-validated), deterministic DAG swimlane layout, optional/description node vocabulary, progress bar, deep-links (optimizes FR-5) | main lands the pending uncommitted batch (uuid fallback + e2e harness) | **done** (closed 2026-11-06; baselines: rspec 1325 · vitest 874 · e2e 19 passed + 1 opt-in smoke spec; branch `epic/p3-16-roadmap` + T4 `p3-16/t04-e2e-close`) |

## Parking lot (unspecced candidates — nominate/reorder at will)

- Roadmap editor (drag/connect; needs persisted positions) — deferred from epic-16's out-of-scope.
- Touch interaction batch (pinch-zoom, drawer gestures) — deferred from epic-16 + spine.
- Bundle code-splitting beyond pdfjs (NFR-6 deferred row) — trigger stays "if demo load time hurts".
- Hub state-field tails + MaterialsPage demo data — the §6.2 survivors parked on the spine
  Deferred table at epic-14 close.
- AI proposal quality pass (two-stage generation for bigger graphs) — only if the ≤16 cap proves
  tight in practice.

## Sequence notes

- Single lane to start: 16 (T1 backend → T2 layout → T3 UX → T4 e2e/close). Nothing else is
  specced; parking-lot items become epics on owner nomination.
- **Pre-flight satisfied (2026-11-06):** the uuid-fallback + e2e-harness batch landed on main via
  PR #16 (`3f55e1b`, rspec 1290 / vitest 836 baseline, 15 e2e specs) — `epic/p3-16-roadmap` cuts
  from a clean main.

## Owner-side (ready-for-human) items

| When | Item | Feeds |
| --- | --- | --- |
| before epic-16 branch | review + land the pending uncommitted batch (uuid fallback + e2e harness) | epic-16 T4 extends the e2e harness |
| any time | nominate/reorder parking-lot items into epics | the rest of Phase 3 |
