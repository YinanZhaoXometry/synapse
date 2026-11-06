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
| 16 | [interactive-roadmap](epic-16-interactive-roadmap/epic.md) | roadmap.sh-grade reading mode: real prerequisite edges (AI-expressed, server-validated), deterministic DAG swimlane layout, optional/description node vocabulary, progress bar, deep-links (optimizes FR-5) | main lands the pending uncommitted batch (uuid fallback + e2e harness) | **done** (closed 2026-11-06; final baselines incl. the dual-axis review-fix round: rspec 1326 · vitest 875 · e2e 19 passed + 1 opt-in smoke spec; PR #18; full e2e re-verified on the merge candidate via epic-17's new CI e2e job) |
| 17 | [test-hardening](epic-17-test-hardening/epic.md) | measure what you assert: coverage both stacks (SimpleCov / @vitest/coverage-v8), spec_helper modernization (random order), the 15-spec e2e suite onto CI, backend wire/module/N+1 gap closure, frontend hygiene + high-value direct tests (quality work, no PRD scope) | none — independent of 16 | done (2026-11-06, PR #17) |

## Parking lot (unspecced candidates — nominate/reorder at will)

- Roadmap editor (drag/connect; needs persisted positions) — deferred from epic-16's out-of-scope.
- Touch interaction batch (pinch-zoom, drawer gestures) — deferred from epic-16 + spine.
- Bundle code-splitting beyond pdfjs (NFR-6 deferred row) — trigger stays "if demo load time hurts".
- Hub state-field tails + MaterialsPage demo data — the §6.2 survivors parked on the spine
  Deferred table at epic-14 close. ✅ consumed — nominated as epic-18 (done 2026-11-06; spine rows closed/annotated).
- AI proposal quality pass (two-stage generation for bigger graphs) — only if the ≤16 cap proves
  tight in practice.

### Nominated queue — ALL five nominated by the owner 2026-11-06 ("这几个全都一次安排做完")

The owner's nomination fires every parked trigger (including the two conditional ones). Single
lane, spec lands at each epic's kickoff (delta-grill-at-kickoff convention — later specs learn
from earlier landings). No numbers are claimed beyond 18–22 for this batch.

| # | Epic (slug) | One-line scope | Gate | State |
| --- | --- | --- | --- | --- |
| 18 | `epic-18-hub-tails` | §6.2 survivors, both spine rows: Materials hub server backing (re-point `/materials` at the existing materials queries — the retained page's demo rows die), MistakeEntry resolved/reviewed lifecycle (flag + hub surface), Today's suggestion slot takes epic-10-T5's documented consumer shape | none — starts now | **done** (closed 2026-11-06; five tickets landed on `epic/p3-18-hub-tails` @ 2cbef6f + T5's close-out; final baselines: rspec 1452 · vitest 917 · e2e 21 passed + the opt-in visual smoke; targeting-bonus open-only variant consciously deferred to epic-21 — spine annotated) |
| 19 | `epic-19-bundle-split` | route-level code splitting beyond pdfjs (NFR-6 discipline: measure first — build-size report pinned in the epic record — then React.lazy per feature route; no new deps) | 18 (serial lane) | **done** (closed 2026-11-06; entry −29.5% min / −26.6% gzip (1,026,203 → 723,680 B min / 275,799 → 202,315 B gz); tripwire live (CI size-summary step + chunkSizeWarningLimit 800); baselines rspec 1452 · vitest 920 · e2e 21; branch `epic/p3-19-bundle-split`) |
| 20 | `epic-20-touch-batch` | pinch-zoom on the roadmap canvas + drawer gestures (spine row: pointer-drag pan/wheel/buttons already ship); AD-9 keyboard contract untouched | 19 (same canvas files as 22 — keep away from it) | queued |
| 21 | `epic-21-ai-proposal-quality` | two-stage generation (outline → per-stage enrichment) for bigger graphs; re-estimates the ≤16 cap with the quality data (epic-16 grill decision 3 amended only if evidence supports); GLM daily-cap discipline | 20 (layout 16-node fixtures ride any cap change before the editor builds on them) | queued |
| 22 | `epic-22-roadmap-editor` | drag-to-reposition + manual connect/disconnect; **reverses epic-16 delta 5** (positions persist; explicit positions override the deterministic layout; fork carries positions; edge edits run the same stage-forward validation); biggest slice — last on purpose | 21 | queued |

## Sequence notes

- Two lanes as of 2026-11-06: 16 (roadmap feature) and 17 (test hardening). They are code-disjoint
  except `.github/workflows/ci.yml` and `frontend/playwright.config.ts` (both epics touch them) —
  do not interleave; land one and rebase the other. 17 is owner-commissioned same-day (test
  completeness audit → plan approved).
- **Pre-flight satisfied (2026-11-06):** the uuid-fallback + e2e-harness batch landed on main via
  PR #16 (`3f55e1b`, rspec 1290 / vitest 836 baseline, 15 e2e specs) — `epic/p3-16-roadmap` cuts
  from a clean main.

## Owner-side (ready-for-human) items

| When | Item | Feeds |
| --- | --- | --- |
| before epic-16 branch | review + land the pending uncommitted batch (uuid fallback + e2e harness) | ✅ done 2026-11-06 (PR #16) |
| any time | nominate/reorder parking-lot items into epics | ✅ done 2026-11-06 — all five nominated as epics 18–22 (queue above); the parking lot itself is now empty |
