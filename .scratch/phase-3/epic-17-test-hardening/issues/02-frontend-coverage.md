# 02: Frontend coverage — @vitest/coverage-v8 over all of src/, CI coverage run + summary + artifact

**What to build:** the same measurement story on the web side, using the v8 provider with
`all: true` so untested modules show up (31k LOC of source against 21k of tests — the honest
number matters). The vitest invocation gains `--coverage` in the CI job and the justfile gate
(the three copies of the gate — justfile, ci.yml, AGENTS.md Commands — move together); local
`pnpm run test` stays plain for iteration speed, with `test:coverage` added alongside.
Thresholds are NOT set here (02 records the measured numbers; 10 ratchets them).

**Blocked by:** —.

**Status:** ready-for-agent

**Bound by:** pnpm-only toolchain (AGENTS.md), vitest 3.2.4 (coverage provider pinned to the
matching minor), AD-10.

- [ ] `@vitest/coverage-v8@3.2.4` added via pnpm; `test:coverage` script added
- [ ] `vitest.config.ts` coverage block: provider v8, `all: true`, `include: ["src/**"]`,
      excludes for `src/test/**` (harness + integration walks, not shippable code) and
      `src/types/**` (codegen output — never edit, per AGENTS.md), reporters
      `["text", "html", "json-summary"]`
- [ ] ci.yml frontend job: Test step runs `vitest run --coverage`; step summary from
      `coverage/coverage-summary.json` totals; HTML artifact upload (retention 7d)
- [ ] justfile spec recipe web-test step gains `--coverage` (gate parity — AGENTS.md's stated invariant)
- [ ] AGENTS.md Commands section synced
- [ ] Full web gates green (codegen freshness, tsc, eslint, vitest --coverage, build, anti-drift)
- [ ] Measured baseline recorded in Comments (line %, notable zero-coverage files confirming the audit list)

## Comments

- (none yet)
