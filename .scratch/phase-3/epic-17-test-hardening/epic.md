# Epic 17 (Phase 3) — Test hardening: measure what you assert (backend + frontend + e2e/CI)

Status: ready-for-agent (spec'd + ticketed 2026-11-06 under the standing decide-all delegation; born from a full-stack test-completeness audit — five scout tracks condensed below)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) · quality work, no PRD scope change · AD-10 (domain tests mandatory; commands and GraphQL ops tested directly — see `backend/AGENTS.md`), AD-12/AD-13/AD-14 (command layer, scoping honesty, mastery vectors), AD-9 (a11y floor) · audit baseline main `3f55e1b` (rspec 1290 / vitest 836 / 15 e2e, all green).

## Audit verdict (2026-11-06 — tracks: backend test infra / backend app↔spec map / schema 74-op wire map / frontend vitest / e2e+CI)

All three layers are unusually disciplined for a course project: backend 127 spec files at 1.44:1
spec:app line ratio, 44/44 command classes, 71/74 GraphQL ops exercised over HTTP, mastery golden
vectors (41 exact-equality cases), a dynamic user-scoping roster that auto-covers new models;
frontend 97 test files with 0 skip/only/ts-ignore, a hand-built deterministic GraphQL echo harness,
an architecture grep-guard; e2e production-grade stub provider with fail-don't-fake semantics.
The genuine SOTA gaps:

| # | Gap | Layer | Evidence |
| --- | --- | --- | --- |
| 1 | No coverage measurement anywhere | both | no simplecov / @vitest/coverage-v8 / thresholds; CI has no coverage step |
| 2 | spec_helper suggested config block entirely `=begin`-commented | backend | `backend/spec/spec_helper.rb:49-93` — random order, focus filter, profile, examples.txt all off; order-dependency undetectable |
| 3 | e2e never runs unattended | CI | the 15-case suite is local-only (`just e2e`); ci.yml has no Playwright step |
| 4 | 3 mapping mutations have zero wire-level tests | backend | mapMaterialSections / confirmMappingProposals / rejectMappingProposals — command specs only; sole fence is the auth_surface field roster |
| 5 | 4 mutations happy-path-only on the wire | backend | generateFlashcards, gradeOpenAnswer, createStreamTicket, rateFlashcard |
| 6 | 5 indirect-only modules, no direct specs | backend | Ai::Prompts (372 LOC, zero spec refs), Ai::TargetingCandidates, EvidenceRecordsSource (batching + user_id leak guard unasserted), DocumentValidation (253 LOC), SectionValidation |
| 7 | N+1 query-count guards on only 2 read shapes | backend | planNodeMappings documents its own eager-N+1 risk, unguarded |
| 8 | Frontend high-value logic without direct tests | frontend | QuizRunner (444), parse-pdf, OnboardingPage (207), MaterialsPage (151); ReaderPage/PdfPageFlow deliberately e2e-guarded (decision 3) |
| 9 | i18n parity only namespace-scoped | frontend | 4 namespace walks exist; the 1,854-line dictionary has no full zh/en guard |
| 10 | Hygiene residue | both | backend `resolvers/base_resolver.rb` dead (0 refs); frontend `src/test/example.test.ts` placeholder + `playwright-fixture.ts` (imports removed lovable pkg); FORBIDDEN dead enum value; CI uploads no artifacts |

## Decisions (2026-11-06, decide-all delegation)

1. **Restraint is the SOTA posture**: no new test gems except simplecov + @vitest/coverage-v8.
   No webmock/vcr/timecop/shoulda-matchers/rspec-retry (the TCPServer stub + TimeHelpers discipline
   is deliberate — retry masks flakes); no msw (the apollo-harness echo server is the repo idiom
   and adequate); no fast-check property tests; no Storybook/visual regression; no perf budget;
   no Dependabot/CodeQL at course-project scale.
2. **fireEvent legacy is not mass-migrated** (401 uses across 37 files). Convention going forward:
   new interaction tests are userEvent-first; opportunistic migration only. Recorded in AGENTS.md (04).
3. **ReaderPage (1,025 LOC) and PdfPageFlow (580) get no component tests** — jsdom+pdfjs cost
   outweighs value; they are guarded by e2e S4 plus the annotation/selection unit suites beneath
   them. Recorded decision, not an accident.
4. **jsdom ^20 stays** — a dependency upgrade with regression risk, out of epic scope (known item).
5. **FORBIDDEN stays, marked reserved** — removal would churn the frontend errors.ts mirror for
   zero behavior; the closed-enum spec gets a one-line note.
6. **ai:probe stays manual** (AGENTS.md), minio integration specs stay in the default run (CI
   provisions minio), SSE client-disconnect paths stay an accepted gap (ActionController::Live
   disconnects are not drivable in request specs).
7. **Coverage thresholds are ratchets, not targets**: 01/02 measure and set floors at measured−2;
   10 raises them to the landed numbers. No aspirational percentages.
8. **The e2e CI job is allowed to be the slowest job** (dev-image build + serial suite); it runs
   `needs: [frontend, backend]` so it only spends those minutes on otherwise-green pushes.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-backend-coverage.md](issues/01-backend-coverage.md) | — | SimpleCov line+branch on app/, layer groups, CI step summary + HTML artifact, floor at measured−2 |
| 2 | [02-frontend-coverage.md](issues/02-frontend-coverage.md) | — | @vitest/coverage-v8 (all-files), CI coverage run + summary + artifact, gates kept in sync (justfile/ci/AGENTS.md) |
| 3 | [03-spec-helper-modernization.md](issues/03-spec-helper-modernization.md) | — | random order + seed repro, focus filter, examples.txt, profile 10; order-dependency leaks fixed |
| 4 | [04-frontend-hygiene.md](issues/04-frontend-hygiene.md) | — | 2 dead files removed, observer stubs, full-dictionary zh/en parity test, userEvent-first convention |
| 5 | [05-e2e-on-ci.md](issues/05-e2e-on-ci.md) | 1, 2 (ci.yml sequencing) | e2e job in CI (compose stack + chromium), retries/reporter/trace artifacts; stretch axe smoke |
| 6 | [06-backend-wire-completion.md](issues/06-backend-wire-completion.md) | — | 74/74 ops wire-covered; 4 weak mutations get wire error codes |
| 7 | [07-backend-indirect-modules.md](issues/07-backend-indirect-modules.md) | — | direct specs for Prompts / TargetingCandidates / EvidenceRecordsSource / 2 validation mixins |
| 8 | [08-backend-n1-guards.md](issues/08-backend-n1-guards.md) | — | shared query-count helper; planNodeMappings + plans guarded; 2 inline counters retrofitted |
| 9 | [09-frontend-high-value-tests.md](issues/09-frontend-high-value-tests.md) | — | QuizRunner / parse-pdf / OnboardingPage / MaterialsPage direct tests |
| 10 | [10-close-out.md](issues/10-close-out.md) | 1–9 | dead code removed, FORBIDDEN reserved, floors ratcheted, docs synced, epic closed |

## Definition of done

All 10 tickets done · rspec ≥1290+new and rubocop green · vitest ≥836+new and eslint/tsc green ·
CI three jobs green including the new e2e job · both stacks measure coverage with ratcheted
floors · 74/74 GraphQL ops wire-covered · full-dictionary i18n parity enforced · AGENTS.md/roadmap
synced · session memory written.

## Coordination notes

- **Lane vs epic-16:** 16 (roadmap feature) and 17 (test hardening) are code-disjoint except
  `.github/workflows/ci.yml` and `frontend/playwright.config.ts` (16-T4 extends the e2e harness).
  Land 17's ticket 05 first, or rebase 16-T4 onto it; do not interleave.
- 03 (random order) may surface latent backend order-dependency — fixing those leaks is in-scope
  for 03, not scope creep.
- Audit source: five scout reports (2026-11-06 session) condensed into the table above; raw
  details live in the session transcript, not the repo.
