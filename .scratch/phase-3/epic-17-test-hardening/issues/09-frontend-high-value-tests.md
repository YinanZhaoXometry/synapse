# 09: Frontend high-value direct tests — QuizRunner, parse-pdf, OnboardingPage, MaterialsPage

**What to build:** component/unit tests for the four untested-with-logic modules the audit
ranked. `QuizRunner.test.tsx` pins the answer-submission contract (option select → submit →
next; the one-question-at-a-time flow) using the harness idioms `use-quiz-session.test.tsx`
already established. parse-pdf gets a real extraction test following whatever pdfjs invocation
shape the parse-pptx/parse-material tests established (if pdfjs-in-jsdom proves prohibitive, pin
the pure extraction/normalization seams it wraps and record why in Comments —
ReaderPage/PdfPageFlow stay deliberately e2e-guarded per epic decision 3). OnboardingPage and
MaterialsPage follow the existing 15-page test pattern (MockedProvider / apollo-harness, render
key states, assert user-visible contracts).

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** existing test idioms only (no new deps — NFR-6); the strict:false TS posture (don't
tighten types while writing tests); ThemeProvider/LanguageProvider wrappers as the page tests
already use them.

- [x] QuizRunner.test.tsx: submission contract incl. the keyboard map, verdict pacing, forfeit variant
- [x] parse-pdf test: REAL extraction (in-test-built minimal PDF, pdfjs fake-worker path)
- [x] OnboardingPage.test.tsx + MaterialsPage.test.tsx per the page-test pattern
- [x] web gates green (vitest 854/854 over 101 files; tsc/eslint clean)

## Comments

- **17 new tests, 854 total** — the audit's four ranked untested-with-logic surfaces all have
  direct suites now. ReaderPage/PdfPageFlow stay deliberately e2e-guarded (epic decision 3).
- `QuizRunner.test.tsx` (7): fixtures are the REAL session-machine's outputs
  (startQuizRun/selectOption/submitCurrent/forfeitCurrent) — never hand-built views, so the test
  cannot drift from the machine. Pins: masked view shows no reveal marking, the
  unselected/empty-answer confirm guards, driver-typed open answers, the verdict pacing step
  (correct + wrong-pick marking only post-submit, 下一题 resumes the machine's next question),
  the forfeit variant (已放弃 marker, wrong visuals), the full keyboard map (digit→index−1,
  Enter confirm, Esc → exit-once → abandon + onAbandoned), and the honest resume note.
- `parse-pdf.test.ts` (4): a minimal multi-page PDF built in-test with computed byte offsets
  (standard-14 Helvetica — no font data, the module header's promise) exercises the REAL pdfjs
  legacy/fake-worker path: page-N ids, heading-like titles, the prose-fallback (ASCII-only —
  standard-14 can't encode CJK; the language switch tested via the fallback wording), zero-page
  → []. The zero-test-coverage module is now pinned end-to-end.
- `OnboardingPage.test.tsx` (3): the three-step wizard over real navigation — welcome → goal
  gate (continue disabled until a pick, hint shown) → multi-select aria-pressed → back preserves
  the draft → ready echoes the picks → enter lands Plans Home; skip door → /dashboard; the
  language toggle flips the copy. jsdom lesson re-learned: a button reference from an unmounted
  step must be re-queried.
- `MaterialsPage.test.tsx` (3): the demo-data page's durable user contract — every row carries
  the plan-wide scope chip (FR-44 display), tag filter narrows and restores, bilingual search
  narrows + honest empty state + clear restores.
- Assertion-string lessons (all four initial failures were test-side, zero product bugs):
  digit keys are 1-based (key "2" → index 1), quiz.forfeited zh is 已放弃 (not 看答案), goals
  survive step navigation, and standard-14 fonts cannot carry CJK text.
