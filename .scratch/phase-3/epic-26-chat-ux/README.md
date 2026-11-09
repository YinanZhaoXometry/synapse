# Epic 26 — chat-ux: chat markdown rendering + message copy

Status: in-progress
Origin: 2026-11-09 owner grilling round — batch ② of the three-batch consensus (「全按推荐」).

## Why

AI replies carry markdown (bold / tables / code / lists) that renders as raw
syntax in every chat bubble (`whitespace-pre-wrap` everywhere), and no bubble
offers copy. Owner: 「AI 的回复有的是 markdown 格式但并没有按 markdown 渲染；AI
的回复和我发送的消息应该能支持复制，就像一般的 AI agent 应用那样。」

## Tickets

- T1 chat markdown rendering — [01-t1-chat-markdown.md](01-t1-chat-markdown.md)
- T2 copy affordance — [02-t2-copy.md](02-t2-copy.md)

## Decisions

- **AI + streaming bubbles render markdown; user bubbles stay
  `whitespace-pre-wrap` plain text.** Rationale: the owner's reference is
  "一般的 AI agent 应用" — those render user text verbatim and never
  reinterpret it (a typed `#`/`1.` must not silently become markup). This
  refines the grilling Q6(a) "all bubbles" letter; recorded here for the
  owner to veto.
- Copy copies the **raw text**: user → `entry.text`; AI → the rendered lead
  (without the ```synapse-quiz fence — copying fence JSON is useless).
- react-markdown import sites: `components/shared/chat-markdown.tsx` joins
  `reader/markdown-view.tsx` as the only two; both consumer graphs are
  lazy-route chunks (AD-8's intent — react-markdown never rides the eager
  entry). Bundle verified post-build against epic-19's tripwire.
- Quiz fence order law (epic-24): `splitQuizBlock`/`leadBeforeQuiz` runs
  BEFORE markdown rendering, unchanged.
