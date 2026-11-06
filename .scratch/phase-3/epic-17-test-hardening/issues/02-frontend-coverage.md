# 02: Frontend coverage — @vitest/coverage-v8 over all of src/, CI coverage run + summary + artifact

**What to build:** the same measurement story on the web side, using the v8 provider with
`all: true` so untested modules show up (31k LOC of source against 21k of tests — the honest
number matters). The vitest invocation gains `--coverage` in the CI job and the justfile gate
(the three copies of the gate — justfile, ci.yml, AGENTS.md Commands — move together); local
`pnpm run test` stays plain for iteration speed, with `test:coverage` added alongside.
Thresholds are NOT set here (02 records the measured numbers; 10 ratchets them).

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** pnpm-only toolchain (AGENTS.md), vitest 3.2.4 (coverage provider pinned to the
matching minor), AD-10.

- [x] `@vitest/coverage-v8@3.2.4` added via pnpm; `test:coverage` script added
- [x] `vitest.config.ts` coverage block: provider v8, `all: true`, `include: ["src/**"]`,
      excludes for `src/test/**` (harness + integration walks, not shippable code) and
      `src/types/**` (codegen output — never edit, per AGENTS.md), reporters
      `["text", "html", "json-summary"]`
- [x] ci.yml frontend job: Test step runs `vitest run --coverage`; step summary from
      `coverage/coverage-summary.json` totals; HTML artifact upload (retention 7d)
- [x] justfile spec recipe web-test step gains `--coverage` (gate parity — AGENTS.md's stated invariant)
- [x] AGENTS.md Commands section synced (also fixed the stale `cd web` paths left from the
      2026-11-04 folder rename — block now reads `cd frontend`)
- [x] Full web gates green (tsc, eslint, vitest --coverage, build)
- [x] Measured baseline recorded in Comments

## Comments

- **Measured baseline (2026-11-06, local): lines 66.58% · branches 85.19% · functions 79.31%
  · statements 66.58%, 206 src files tracked.** This is the honest all-files number — the audit's
  "97 test files, 21k LOC" never had a denominator before.
- The 0% tail is dominated by the 46 `src/components/ui/*` shadcn primitives (AGENTS.md: "treat
  as generated code"), `main.tsx` (bootstrap), and pure type/view modules (`api/views.ts`,
  `ai/types.ts`). Excluding ui/ from the denominator would flatter the number without making the
  code more tested — kept excluded-from-nothing; ticket 10 pins thresholds against the honest
  figure (lines ~64 = measured−2).
- Audit-confirmed zero-coverage pages visible in the report: `MaterialsPage.tsx` 8.08%,
  `OnboardingPage.tsx` 11.36%, `NotFound.tsx` 26.08% (ticket 09 targets the first two).
- pnpm add pruned a stale node_modules-only `lovable-tagger` residue (lockfile already clean —
  verified the lockfile diff is pure addition).
