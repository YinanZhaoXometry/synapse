# T6: Integration walks, responsive/theme/i18n sweep, gates, epic close (AD-9/10)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 04-task-flow-wiring.md, 05-quiz-page-repoint.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's verification and close (epic-3/epic-5 precedent). Two integration
walks at repository + session level: the plan loop (material attached →
generate → answer across modes → evidence → mastery movement visible through
the domain seam) and the task loop (task quiz → evidence on the task node →
ring updates everywhere via the invalidation). A full sweep of every new
surface — quiz launcher/runner/results, flashcards study, task variants,
re-pointed `/quiz` — across the responsive ladder (desktop/tablet/mobile) and
light + dark × sunset/twilight/aurora, an i18n zh/en parity pass with sonner
as the only toast pattern, then all gates green and the tracker closed with
deferred follow-ups recorded.

## Acceptance criteria

- [x] Plan-loop integration walk passes (material → generate → answer → evidence → movement; ADR-0001 numbers asserted exactly). — `src/test/plan-quiz-loop.integration.test.tsx`: the T2 walk asserts round 75%, n1 0%→99% capped + cap note ×2, n2 0%→50% (partial=0.5), evidence outcomes/order, zero mistakes, completed status, reload honesty. T6 added the retake-chain leg (same file) so the walk anchors ALL four ADR-0001 numbers: 99 capped → 100 mastered (≥80 AND ≥3, cap note gone) → last-5 window eviction (100→60 / 75→50, the un-windowed 67% never renders) → 4 auto-logged mistakes across 3 fresh generated sessions.
- [x] Task-loop integration walk passes (task quiz → task-node evidence → Plans Home + Task Home freshness via invalidation). — `src/test/task-quiz-loop.integration.test.tsx` (unchanged, verified): task dialog (no scope picker) → choice run → evidence on the task's node only (planId null, taskId set) → computeNodeScore/TaskRollup 99 capped + state partial → `queryKeys.tasks.all` invalidated → Task Home ring AND Plans Home task section read 99% fresh → sibling plan rollup stays 0 → flashcards leg persists ratings with the evidence store byte-identical.
- [x] Every new surface verified in light + dark × sunset/twilight/aurora × desktop/tablet/mobile; i18n zh/en parity sweep clean; sonner-only toasts. — code level done in T6: token grep clean (only the scaffold-accepted `text-white`-on-`bg-gradient-hero` convention; zero raw palette/rgba/hex); parity tests green + strict CJK/EN string scans clean across every epic-6 surface; sonner-only toasts (no `use-toast`, no shadcn Toaster usage); keyboard maps wired + tested (quiz 1–4/Enter/Esc, flashcards Space/←→/Esc); responsive ladder present (max-w shells, flex-wrap footers, sm:/md:/lg:). The VISUAL 双主题双视口 smoke is the orchestrator's at close (per T6 instructions — code-level only here).
- [x] Gates green via direct `node_modules/.bin` binaries (`npx tsc -b`, eslint, `vitest run`) — never `npm run`. — verified at T6 (see implementation notes for the tails).
- [x] Epic closed in the tracker: tickets marked done, deferred follow-ups (multi-select choice, SRS/re-queue FR-24, hubs FR-41/42, Mistakes Notebook FR-23, node-level scope) recorded with their Phase-2 pointers. — deferred list + closure skeleton written in [epic.md](../epic.md) at T6; the orchestrator flips statuses / fills final numbers at close.

## Implementation notes (T6 sweep results, for the epic close)

- **Walk coverage verdict:** both walks existed and passed; the plan walk missed
  window-5 eviction and mastered-at-≥80-and-≥3 (they lived only in the domain
  unit tests). Strengthened with the retake-chain leg — three mix rounds via
  再来一轮 through the same UI/repository seams, exact numbers asserted on the
  results screen AND cross-checked through `computeNodeScore`/`getNodeState`.
- **T4 resume-note sweep candidate — fixed (small + clearly better):** a
  Plan/Task Home DIALOG launch landed on `?session` indistinguishably from a
  reload and rendered the honest-reload 「已恢复」 note — a false claim on the
  epic whose point is making claims true. Fix: `QUIZ_FRESH_LAUNCH_KEY`
  (sessionStorage, written by QuizLauncher at `onStarted`, consumed once by
  QuizSessionPage) suppresses the note for that deliberate launch; a genuine
  reload finds no marker and keeps the note (T2's retake precedent already
  pinned the note's meaning as reload-resume-only). Tests: task dialog-launch
  marker test (suppress + consume + reload shows) + the plan walk now asserts
  no note after its dialog launch.
- **Sweeps:** tokens clean (8 `text-white` hits, all the scaffold's
  gradient-hero convention — flagged, not fixed); i18n parity green + no
  hardcoded strings; toasts sonner-only; keyboard contracts intact;
  responsive patterns verified present at code level.
- **Epic table drift check:** none — the six slices match what shipped (T1
  machine headless; T2 plan quiz; T3 flashcards; T4 shared shells + task
  wiring; T5 re-point; T6 this).
- Gates at T6: `tsc -b` 0 errors; eslint 0 errors (10 pre-existing scaffold
  warnings); vitest <see close for final counts> — the orchestrator re-runs
  and records.

## Close verification (orchestrator, 2026-11-03)

- Two-axis review: **P0:0 P1:0 P2:3 — PASS-WITH-FIXES**; all three P2s fixed in
  `f73f7d8` (failure-honest evidence pill from real records, releaseGrading
  grading-failure escape + driver catches + toasts, feature-barrel imports) with
  +7 tests (machine transition, driver seam-rejection recovery loop, pill
  honesty variants).
- Browser smoke (orchestrator, IAB): 11 checks green — quiz full loop (six
  questions incl. grading wait / forfeit / partial), results with real evidence
  claim, plan-rollup freshness 0%→75%, flashcards study flow, task tiles +
  scoped launcher, /quiz demo picker, sunset light+dark, aurora dark, mobile
  390×844. Smoke artifacts cleaned; user environment restored.
- Final gates: tsc 0 errors · eslint 0 errors (10 pre-existing scaffold
  warnings) · vitest **400/400** (53 files).
