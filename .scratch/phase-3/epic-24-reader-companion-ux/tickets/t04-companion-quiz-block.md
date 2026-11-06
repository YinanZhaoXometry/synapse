# T4 — Companion: always-visible chips + interactive quiz block

Status: done
Epic: [epic-24](../epic.md) · Spec: [spec.md](../spec.md) §Q4

## Goal

Intent chips never vanish; 考考我 ends in an interactive question block
(choice / short) with submit → verdict → correct answer → explanation, NFR-8
clean. Wire unchanged; persistence rehydrates.

## Changes

- `frontend/src/features/companion/message-shaping.ts`: `splitQuizBlock(text)`
  → `{ lead, quiz: CompanionQuiz | null }` (typed + validated; malformed fence
  → quiz null, text intact); `CompanionQuiz` type (choice/short). Exported
  `QUIZ_FENCE_MARKER`.
- `frontend/src/features/companion/quiz-block.tsx` (NEW): the interactive
  block — choice (single-select options, submit) / short (textarea, submit);
  post-submit lock + verdict + correct answer + explanation; test ids
  `quiz-block-option-*`, `quiz-block-submit`, `quiz-block-short-input`,
  `quiz-block-verdict`; i18n `companion.quiz*` keys.
- `CompanionPanel.tsx`: bubbles render lead + QuizBlock; StreamingBubble hides
  the fence tail (出题中 line once the marker appears); chips always rendered
  (reading: when the material can chat; plan: always) — disabled while
  busy/gated, mistake chip keeps its empty-state rule.
- `frontend/src/ai/simulated/companion.ts`: quiz-me emits a deterministic
  fence derived from the grounding text (cloze choice when a salient term
  exists, short "explain" otherwise), still cited; zh + en copy.
- `backend/app/lib/ai/prompts.rb`: companion + plan_companion gain the
  quiz-me instruction (one ```synapse-quiz fence, materials-sourced, language-
  matched, answer never outside the block); prompt specs assert it (zh + en).

## AC

- Chips visible mid-conversation (reading + plan), disabled while streaming.
- Choice: select → submit → verdict/correct/explanation; short: type → submit
  → same; nothing reveals pre-submit (NFR-8 asserted in tests).
- Malformed fence → plain text bubble (no crash, no fake block).
- Restored thread rehydrates the block (entriesFromThread → bubble parse).
- Simulated quiz-me reply parses to a valid block, grounded on position text.
- Backend: prompt specs green, rspec full suite green, rubocop clean.

## Close-out

Both surfaces, both providers, persistence — landed; wire byte-unchanged
(stub provider untouched; e2e scope unchanged).
