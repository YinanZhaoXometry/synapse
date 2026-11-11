# Spec — epic-34 plan-content-loop（计划→学习内容闭环 / A档）

Status: ready-for-agent · Spec date: 2026-11-11 · Pipeline: `/grill-with-docs`（两轮 10 决策共识，2026-11-11）→ 本 spec → `/to-tickets`
Vocabulary: GLOSSARY.md §Node teaching & mapping（AI 讲解 / Unmapped node / Auto-mapping — 本 spec 落地时新增）
Evidence base: `.scratch/phase-4/synapse-plan-to-learning-flow.md`（before 基线：三断链 + 手动/自动对照表）、`.scratch/phase-4/deeptutor-book-engine-deep-dive.md` §11（吸收清单与出处）

## Problem Statement

学习者建好一个计划后，不知道从哪里开始学。具体体感：计划到手只有一张节点图——材料挂在右栏但**章节→节点的映射默认是空的**，除非自己找到折叠在材料行下面的映射面板并手动点「AI 映射」；节点点开只有「去学习/节点快测」，**没有一个「给我讲」的入口**；创建完成的那一刻起，**没有任何东西自动发生**。结果：Mastery 永远是零，学习者以为产品坏了。（before 全景见基线文档 §1-§3。）

## Solution

三件事补全「有了计划→开始学」的编排：**Auto-mapping** —— 计划页对「已解析且零映射行」的材料自动跑一次映射提案，让 coverage 不再需要用户主动发现；**AI 讲解** —— 每个节点常显的 teaching 动作，打开计划级 Companion、以该节点（node scope + 其 confirmed 映射章节）为 grounding 开讲，无映射时诚实说没有材料、绝不编造；**provider 硬化** —— 修复层/故障分类/有界重试，让这条自动链路在 provider 抖动时体面降级而不是整轮报废。全程零新生成内容、零新学习界面、零后台作业——mastery 仍是 evidence-only（ADR-0001），渲染仍读服务端字段（AD-14），额度仍是单一 DailyCap（AD-16）。

## User Stories

**Auto-mapping（T3）**
1. As a learner, I want materials I staged during plan creation to get mapping proposals automatically once parsed, so that I land on the plan page and coverage is already filling in.
2. As a learner, I want a material I attach to an existing plan to trigger the same auto-mapping, so that the post-creation path and the later-attach path behave identically.
3. As a learner, I want auto-mapping to fire at most once per page visit per material, so that a flaky provider cannot burn my daily cap in a loop.
4. As a learner, I want the next visit to naturally retry a material that failed auto-mapping, so that transient failures self-heal without me filing anything.
5. As a learner, I want my confirmed/rejected mapping decisions to never be overwritten by auto-mapping, so that automation respects my judgment permanently.
6. As a learner, I want the mapping panel to show a distinct state while auto-mapping is running, so that I know something is happening without a toast.
7. As a learner, I want auto-mapping to stay silent on start and success, so that my screen doesn't congratulate itself for doing its job.
8. As a learner, I want a single actionable toast when auto-mapping fails, so that I can retry from the notification instead of hunting for the panel.
9. As a learner, I want the mapping panel to tell me when auto-mapping was skipped because my daily AI cap is exhausted, so that I understand why nothing happened and can decide to wait or stop.
10. As a learner, I want the manual「AI 映射」button to remain at all times, so that I keep an explicit retry independent of automation.

**AI 讲解（T2）**
11. As a learner, I want an「AI 讲解」action on every Knowledge Node, so that any node — mapped or not — has a way to start learning it.
12. As a learner, I want 讲解 to open the plan Companion drawer pre-filled with a short teaching request, so that one click puts me in a teaching conversation.
13. As a learner, I want the prefill to wait for me to press send, so that nothing is spent without my intent.
14. As a learner, I want the teaching turn grounded on that node — its description, its objectives, and the confirmed-mapped sections of my own materials — so that the explanation is about THIS node and cites what I uploaded.
15. As a learner, I want follow-up questions in the same drawer session to keep the node grounding, so that「第二点展开讲讲」doesn't degrade into generic plan-wide answers.
16. As a learner, I want the node grounding to clear when I open the generic plan Companion or pick a different node, so that context follows my intent, not a stale memory.
17. As a learner on an unmapped node, I want 讲解 to honestly tell me no material is attached yet and point me to upload, so that I'm never taught from thin air.
18. As a learner, I want the old「问 AI 导师」node action replaced by 讲解 (not sit beside it), so that the node sheet has ONE ask-style entry and no terminology soup.
19. As a learner reading inside the Reader, I want the existing selection-ask and companion behavior unchanged, so that this feature doesn't disturb how I study a document.

**Coverage honesty（T3）**
20. As a learner, I want the mapping panel to show a computed「unmapped nodes」summary line, so that I can see which nodes have nothing to study FROM, distinct from which nodes I've studied (mastery).
21. As a learner, I want unmapped-node wording kept strictly separate from the mastery「uncovered」wording, so that the two axes never blur.

**Provider hardening（T1 — 学习者可感知的部分）**
22. As a learner, I want a quiz/mapping/note generation that would have died on a slightly-malformed model reply to be repaired and succeed, so that I stop losing whole turns to JSON trivia.
23. As a learner, I want a transient provider hiccup (timeout/unreachable/rate-limit) retried once automatically, so that one blip doesn't waste a manual re-click.
24. As a learner, I want retries to count against my daily cap like any call, so that the cap stays an honest single budget (AD-16).
25. As a learner, I want a genuinely-failed call to surface a failure state that names the cause class, so that「额度用完」「服务不可达」「回复不可用」read as different situations.
26. As a learner using the app in Chinese, I want every AI surface to reply in my language deterministically, so that a JSON-heavy prompt never leaks English strings at me.

## Implementation Decisions

**T1 — provider seam 硬化（backend，独立可先并）**
1. ResponseParser gains a repair layer between the balanced-scan extraction and nil: attempt truncated-tail completion (unbalanced → close open strings/braces) and trailing-comma removal, then re-validate. Extraction order: balanced scan → repair candidates → nil. Callers' schema-validation ownership unchanged (an extracted-but-invalid object is still the INTERNAL path, not silent accept).
2. Provider seam classifies transport faults into a `detail` symbol (`rate_limited | timeout | unreachable | unparseable`) carried in the existing Failure context. The GraphQL-facing failure codes DO NOT change (`CAP_REACHED` stays its own code as today; everything transport-y stays `INTERNAL` + context.detail) — no error-enum breakage, no frontend contract change beyond an optional context read.
3. One bounded auto-retry at the seam, ONLY for `timeout | unreachable | rate_limited`, single extra attempt, ~2s backoff. The retry is a new provider call → consumed by DailyCap normally (deliberate: single honest budget). `unparseable` and cap failures never retry.
4. `Prompts` gains a single language-directive helper; the per-prompt hand-written language lines are replaced by uniform application of it. Intended zero behavior change; parity is asserted by existing prompt specs.

**T2 — AI 讲解（schema + grounding + frontend）**
5. The stream-ticket mutation input gains an optional `nodeId` (plan-companion op only), ownership-checked against the ticket's plan exactly like the existing mistake-entry input. The frozen `/api/stream` SSE contract is untouched; the ticket input is the only surface extended (backward compatible — absent field = today's behavior).
6. When a plan-companion ticket carries `nodeId`, the turn's grounding switches from the plan-wide assembly to a node assembly: the single node (title/description/objectives) + that node's confirmed section mappings (mapped sections' text, budget-bounded) + the standard plan-companion mistake-free scaffolding. The plan-wide materials pool is NOT included (node-pinned semantics already defined by the node scope primitive).
7. The plan-companion prompt gains the honesty directive: when the node has no confirmed mappings (or the plan has no materials), SAY SO and point to uploading/mapping; never teach from parametric memory (the not-written-yet clause).
8. Frontend: `node-actions` renders「AI 讲解」in sheet AND hover strip, ALWAYS (no mapping gate), replacing the「问 AI 导师」action. It opens the plan Companion drawer (plan page shell already mounts it) with a short prefill; prefill is never auto-sent. `nodeJumpTargets`-gated「去学习」stays hidden when unmapped (honest: nothing to jump to);「节点快测」stays always-present.
9. Drawer session memory (frontend state only): while the drawer was opened via 讲解, subsequent turns in that session keep tagging `nodeId` on the ticket; opening the generic plan Companion entry or invoking 讲解 for a different node clears/ replaces it. No server-side thread state is added.
10. The reader-side companionAsk mechanism (selection ask, quick-test prefill) is untouched.

**T3 — Auto-mapping + 覆盖诚实（frontend orchestration + UX）**
11. Plan-page effect: for each material with `parseState === parsed`, sections present, and ZERO mapping rows, and not already fired this mount session → fire the existing mapping mutation once. Session guard is component-lifetime state (a ref), no persistence, no new storage. The CreationChat confirm path is deliberately NOT instrumented — it navigates immediately and the plan-page effect catches the material on arrival (one trigger point, not two).
12. Cap posture: auto-mapping consumes DailyCap like any AI call. On `CAP_REACHED` the panel shows the「额度已用完」state (distinct failure code already exists end-to-end); no silent spending, no second attempt until next visit/manual.
13. Toast policy: silent on start and success (the coverage panel is the surface); exactly one failure toast via the established AppError→messageKey→t() path.
14. The coverage panel gains a computed「unmapped nodes: N」summary line derived from the existing plan-wide mapping read (nodes with zero confirmed mappings). Pure derivation, no new query fields required beyond what plan page already loads.
15. i18n: all new copy lands as dotted keys with zh/en entries (full-parity CI enforces); label zh「AI 讲解」/ en「Teach me」, prefill zh「请给我讲解这个节点」/ en「Teach me this node」.

**Cross-cutting**
16. Zero new server storage, zero background jobs, zero domain-model changes. The committed GraphQL schema regenerates through the standard codegen gate.
17. Ticket slicing: T1 (backend-only, independent) → T2 (schema + grounding + frontend action) → T3 (frontend orchestration + coverage UX + e2e). T2/T3 may develop in parallel; only T3's transport-failure copy nuance benefits from T1's detail classification (CAP is already distinct today).

## Testing Decisions

Good tests assert external behavior only — GraphQL result shapes, SSE stream content, rendered UI states, prompt I/O contracts — never internals. **Zero new seams** (to-spec seam check, owner-delegated): everything hides behind existing contracts.

- **T1**: ResponseParser as the pure extraction seam (repair-layer cases: truncated tail, trailing commas, clean passthrough, nil path) — prior art: its existing spec. Provider with the documented stub-adapter contract (override `.adapter`, never transport): transport faults → assert context.detail classification, retry-once behavior, retry-consumes-cap, no-retry on unparseable/cap. Prompt language parity via existing prompt specs.
- **T2**: ContextAssembler spec family gains the node assembly (node + its confirmed sections; plan-wide pool excluded; unmapped → empty assembly flagged for the honesty directive). Stream-ticket command spec: nodeId ownership (foreign node → NOT_FOUND/VALIDATION as per existing roster conventions; absent nodeId → today's grounding). Frontend: node-actions component tests (userEvent-first) for always-rendered 讲解 + replaced action; plan-companion hook tests asserting nodeId rides every turn within a drawer session and clears on generic open.
- **T3**: the auto-fire selection logic as a pure helper (materials × mappings × session-fired → targets) tested like domain logic; plan-page integration test with mocked hooks (AppLayout's mock-`@/api` convention); coverage panel state tests (running / cap / unmapped summary line). e2e: the stub-provider critical-flow harness gains the loop segment — create with file → auto-mapping rows appear → node 讲解 opens drawer with prefill.
- **Untouched by construction**: mastery golden vectors (no mastery math change), i18n full-parity test auto-covers new keys.

## Out of Scope

- Per-plan context pack / retrieval caching (ExplorationReport pattern) — deferred until any batch-generation feature exists.
- Persisted source-quality report objects (the computed summary line is the v1).
- 补救三件套 (weakness remediation trio), quiz self-grade tri-state, per-node generated lessons (C档-mini), B档 per-node teaching sessions.
- Per-section manual mapping UI (drag/click assign one section).
- Server-side/background mapping jobs; any change to parsing (client-side, AD-7) or reader companion.

## Further Notes

- Grill record (2026-11-11, 2 rounds, 10 decisions) is the decision authority for anything ambiguous here; the GLOSSARY entries (AI 讲解 / Unmapped node / Auto-mapping) are normative vocabulary.
- The seam assumption (zero new seams, highest-seam testing) was auto-advanced under the owner's decide-all delegation — veto here if wrong.
- ADR check performed: nothing cleared the bar (cap-shared-by-automation is policy-reversible; entry replacement is UI-reversible) — recorded here instead.
- Board flow after this spec: `/to-tickets` slices T1/T2/T3 into `.scratch/phase-4/epic-34-plan-content-loop/` with a roadmap.md row; implementation per the worktree discipline (`epic/p4-34-plan-content-loop`, worktree beside the repo).
