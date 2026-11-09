# T1 — chat markdown rendering (epic-26)

Status: in-progress

AI replies render their markdown in every chat surface instead of raw syntax.

## Scope

- `components/shared/chat-markdown.tsx` — react-markdown + remark-gfm over the
  compact `.chat-prose` stylesheet (the third prose posture beside `.reader-prose`
  and the claudette theme; semantic tokens only, dark-mode safe).
- `features/companion/CompanionPanel.tsx` — CompanionBubble lead + StreamingBubble
  partial text render markdown (quiz fence split stays first). UserBubble stays plain.
- `features/plans/CreationChat.tsx` — AI transcript rows + the streaming preview
  render markdown (STREAM_DISPLAY_CAP unchanged, truncation before render).
- `features/quiz/QuizRunner.tsx` — question prompt (heading container keeps
  role/level + focus ref) and the grading rationale / reference explanation render
  markdown.
- `features/companion/quiz-block.tsx` — question + explanation render markdown.

## AC

- [ ] A reply with `**bold**`, a GFM table, and a fenced code block renders as
      table/bold/code in the companion bubble (component test).
- [ ] Streaming partial text renders live (same markdown path; no separate renderer).
- [ ] `​```synapse-quiz` replies: fence never leaks into the markdown render
      (existing epic-24 tests stay green).
- [ ] Full vitest suite green; i18n untouched here (no new strings in T1).
