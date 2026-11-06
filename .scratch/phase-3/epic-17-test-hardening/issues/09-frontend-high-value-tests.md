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

**Status:** ready-for-agent

**Bound by:** existing test idioms only (no new deps — NFR-6); the strict:false TS posture (don't
tighten types while writing tests); ThemeProvider/LanguageProvider wrappers as the page tests
already use them.

- [ ] QuizRunner.test.tsx: submission contract incl. the deliberate-wrong-answer path e2e relies on
- [ ] parse-pdf test: extraction pinned (or seam-pinned with the prohibition recorded)
- [ ] OnboardingPage.test.tsx + MaterialsPage.test.tsx per the page-test pattern
- [ ] web gates green (vitest count grows; tsc/eslint unchanged-green)

## Comments

- (none yet)
