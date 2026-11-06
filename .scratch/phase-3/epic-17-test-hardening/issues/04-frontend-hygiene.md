# 04: Frontend hygiene — dead test residue, observer stubs, full-dictionary i18n parity, userEvent-first convention

**What to build:** three small fixes plus one new guard. Delete the two residue files
(`src/test/example.test.ts` — an `expect(true)` placeholder; `playwright-fixture.ts` — imports
the removed, never-installed lovable package, zero references). Stub
`ResizeObserver`/`IntersectionObserver` in `src/test/setup.ts` (jsdom 20 lacks both; today
nothing invokes them only by luck). Add the global guard the four namespace parity tests imply
but never delivered: full-dictionary zh/en set-equality over every key of
`src/contexts/i18n-dictionary.ts` (any one-sided key it catches is a real user-facing bug — fix
the key, don't allowlist it). Record the interaction-testing convention in AGENTS.md: new tests
are userEvent-first; legacy fireEvent is not mass-migrated.

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** i18n mandatory rule (AGENTS.md Conventions), the existing parity-test idiom
(`src/contexts/i18n-dictionary.test.ts`, `i18n-t5-parity.test.ts` — bidirectional set equality +
truthiness + anti-vacuity check), NFR-6 (zero new dependencies).

- [x] `src/test/example.test.ts` and `frontend/playwright-fixture.ts` deleted (re-verified zero references)
- [x] setup.ts: `ResizeObserver`/`IntersectionObserver` class stubs (observe/unobserve/disconnect
      no-ops), assigned only when undefined
- [x] `src/contexts/i18n-full-parity.test.ts`: every key has non-empty zh AND en; key sets equal
      both directions; anti-vacuity assertion (a planted one-sided key fails)
- [x] One-sided keys caught: **none** — see Comments
- [x] AGENTS.md gains the userEvent-first convention line (frontend tests section)
- [x] web gates green (tsc, eslint, vitest 837/837)

## Comments

- **The dictionary passed full parity first try** — no one-sided keys to fix. The namespace-walk
  discipline plus the i18n-mandatory rule had kept the table honest; the new walk makes that a
  standing guarantee instead of an accident.
- Suite count moved 836 → 837 (−1 placeholder, +2 parity tests).
