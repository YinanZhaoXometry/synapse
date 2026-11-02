# T5: CompanionPanel — page-aware guardrailed chat beside the reading (FR-11/12; AD-5)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 04-position-tracking.md

## Parent

[Epic 3](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The page-aware Companion. From the user's perspective: a chat panel sits beside the reading (docked right in the reader). Questions are answered grounded in the current Reading Position; every answer carries citation chips of the page/section it drew from, and clicking a chip jumps the reader to the source with a brief flash. The Companion guides before it answers — hints and scaffolding first — but an explicit 「直接看答案」 escalation always reaches a direct, still-cited answer: the guardrail is a ladder, never a wall. When the material can't answer, it says so plainly. Answers stream in with citations appearing alongside their claims; conversations persist per material; failures are neutral toasts with one-click retry and preserved input; a material that failed to parse disables the Companion honestly — it never chats against a document it can't see.

The AI call goes through the existing `CompanionService` seam with the simulated adapter — no component performs AI/network calls directly (AD-1/AD-5). SM-2 must be satisfiable in a live demo: three consecutive answers each visibly citing their source location.

## Acceptance criteria

- [ ] CompanionPanel mounts in the reader on the scaffold chat surface pattern (bubbles, typing indicator, sticky input, auto-scroll; Enter send / Shift+Enter newline); idle starters 「解释这一页 / Explain this page」, 「考考我 / Quiz me」, one summarizer starter (FR-11; UX CompanionPanel pattern)
- [ ] Requests call `getCompanionService().chat()` with the current Reading Position (locator + bounded text) and the UI language; features never call the AI seam outside this contract (AD-1; AD-5; FR-10→FR-11 grounding)
- [ ] `GroundedChatRequest` gains a backward-compatible optional `escalated?: boolean`; the simulated adapter honors it by returning the answer rung directly with citations; EscalationControl (「直接看答案 / Show answer directly」) renders when `canEscalate` and works (FR-12 escalation ladder; NFR-2)
- [ ] Guardrail ladder rendered from the structured reply contract, never guessed: direct answers labeled 答案/Answer, hint/worked-step rungs shown as such; quiz-me routes Socratic without revealing before an attempt (NFR-2; UX intent table)
- [ ] CitationChip renders the locator (第 N 页 / section title) and click navigates the reader to the AD-8 anchor with the transient flash — the same channel as external deep links; chips are keyboard-focusable (AD-8; UX CitationChip)
- [ ] Ungroundable questions get the honest-fallback bubble with the distinct general-knowledge offer — never presented as course authority (NFR-1; UX ungroundable state)
- [ ] Streaming: text arrives progressively; citation chips render alongside their claims mid-stream; completion announced once, not per token; reduced-motion respected (UX streaming state; a11y floor)
- [ ] Request failure: neutral toast + one-click retry, input preserved — never silent, never fake success (UX error state)
- [ ] ChatThread persists per material through the existing repositories (citations stored on messages) and restores on open (AD-3; AD-4)
- [ ] Parsing in progress → panel shows idle waiting copy; parse failed → Companion disabled with honest copy (UX parse-failure state)
- [ ] Tests: simulated adapter `escalated` path + grounding on the supplied position + honest fallback (prior art: simulated/companion tests); ChatThread persistence round-trip + reload simulation; the `escalated?` contract amendment documented in the ai seam types
- [ ] All new user-facing strings in the i18n table, zh + en (NFR-5); semantic tokens only — verified in dark mode (AD-9)
- [ ] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched
