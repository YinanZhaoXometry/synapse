# T4: Task-loop integration walk + responsive/theme/i18n pass + gates + epic close (AD-9/10)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-task-home.md, 03-plans-home-task-section.md

## Parent

[Epic 5](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's verification pass. One task-loop integration walk at the repository +
session-blob seam proves the full chain without epic-6's UI: create task → attach
bytes → eager parse → reading-position save → repository-level quiz generation,
session creation, and evidence recording against the task's node → exact ADR-0001
numbers on the task rollup → reload simulation from the same localStorage key.
Then the sweep: responsive ladder for the three new surfaces, light + dark across
the three palettes, i18n parity, grandfathered-surface checks — and the gates.

## Acceptance criteria

- [x] Task-loop integration walk passes (prior art: evidence-loop / reader-loop walks), asserting exact ADR-0001 numbers on the task rollup — including cap-99 below the evidence gate and mastered at ≥ 80 & ≥ 3 — and that task evidence never moves plan scores (AD-6 isolation). — `src/test/task-loop.integration.test.ts`: 2 correct → rollup **99** (raw 100, capped below the gate of 3, state partial); +forfeit +3 correct → 6 records → last-5 window → **80**, exactly the ≥80 threshold with the gate met → **mastered** (the plain mean over 6 would be 83 — the 80 pins the window); sibling plan node stays 0 evidence / rollup 0.
- [x] The walk's reload simulation restores task, node, material metadata, reading progress, and evidence from the persisted document. — `vi.resetModules()` + fresh `@/data` / `@/domain/mastery` imports against the same localStorage key; rollup recomputes to 80/mastered from persisted evidence alone; session bytes gone (re-upload contract).
- [x] Responsive ladder verified for the creation page, task home, and the Plans Home section at desktop/tablet/mobile breakpoints; light + dark × sunset/twilight/aurora all render correctly. — **visual verification done 2026-11-03**: in-app browser smoke at 1440×900 (desktop) and 390×844 (phone), light+sunset and dark+twilight — Plans Home empty + returning states, Task Home, and the create page all render correctly; screenshots taken. Code-level ladder: TaskCreatePage `p-6 md:p-8 max-w-[720px]`, TaskHome the Plan Home ladder verbatim (`p-6 md:p-8 max-w-[1080px]`, `grid lg:grid-cols-[1fr_320px]`, wrap-friendly headers, truncate/min-w-0 rows), PlansHome section the same row pattern + flex-wrap pitch; all tokens semantic (zero raw palette/hex/rgba hits), so palette/dark correctness follows the token contract.
- [x] i18n sweep: no hardcoded user-facing strings in the new feature; zh/en parity across every new key (AD-9). — grep: all rendered strings go through `t()` (CJK hits are comments/test fixtures only); all 17 referenced `tasks.*` keys exist in both languages; durable guard added: `src/contexts/i18n-dictionary.test.ts` asserts tasks.* set parity zh↔en with non-empty copy.
- [x] Grandfathered check: scaffold pages untouched; frozen progress context unwritten (grep-level verification). — `git diff 8b2c895..HEAD --stat -- src/pages/ src/contexts/UserProgressContext.tsx src/lib/demo-data.ts` empty; `useUserProgress`/`UserProgressContext` absent from `src/features/tasks/`.
- [x] Gates green via direct `node_modules/.bin` binaries — `tsc -b`, eslint, `vitest run` (pnpm layout; `npm run` is broken in this environment). — vitest **36 files / 280 tests passed** (baseline 34/278), `tsc -b` clean, eslint `0 errors, 10 warnings` (all 10 pre-existing scaffold files: `src/components/ui/*`, `src/contexts/*Context`).
- [x] Epic closure section written in the epic doc (shipped tickets, fixes, deferred follow-ups — epic-3 format). — written at epic close (see [epic.md](../epic.md) Closure 2026-11-03).
