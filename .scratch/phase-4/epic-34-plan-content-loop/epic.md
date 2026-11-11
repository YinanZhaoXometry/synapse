# Epic 34 — plan-content-loop

Milestone: Phase 4 — learning-engine season (owner A档 greenlight, 2026-11-11)
Status: ready-for-agent
Design source: [spec.md](spec.md)（grill 两轮 10 决策，2026-11-11）· before 基线 [../synapse-plan-to-learning-flow.md](../synapse-plan-to-learning-flow.md) · 吸收出处 [../deeptutor-book-engine-deep-dive.md](../deeptutor-book-engine-deep-dive.md) §11 · Board row: [../roadmap.md](../roadmap.md)

## Scope

Owner 之问「有了计划没有学习内容我怎么学」的 A档答案——补**编排与入口**，不生成任何新内容（与 wontfix 的 book engine 是反方向）：

1. **Auto-mapping** —— plan 页对「parsed ∧ 零映射行」的材料每挂载会话自动跑一次映射提案；coverage 不再等用户发现折叠面板。
2. **AI 讲解** —— 每个节点常显的 teaching 动作（替换映射门槛的「问 AI 导师」）：plan Companion 抽屉 + nodeId grounding（节点 + 其 confirmed 映射章节）+ 诚实条款（unmapped 明说没材料、绝不编造）。
3. **Provider 硬化** —— 提取修复层 / 传输故障分类 detail / 有界重试（计入 DailyCap，AD-16 单额度）/ 语言指令单点。

词汇表已落地：GLOSSARY §Node teaching & mapping（**AI 讲解 / Unmapped node / Auto-mapping**；「未覆盖」保留给掌握度轴 uncovered，映射轴一律说 unmapped）。

## Non-goals（spec §Out of Scope — 勿重议）

- Per-plan context pack（ExplorationReport 缓存）与持久化 source_quality 报告 —— 批量生成 feature 出现前无收益。
- 补救三件套 / quiz 自评三值 / per-section 手动指派 UI / 服务端后台映射作业 / reader companion 改动。
- **C档-mini 节点讲义 —— deferred 非 rejected**：A档 落地后若 owner 仍觉得「读原始材料太干」再议（deep-dive §11.4 的「讲义=生成的材料非新界面」叙事）。Book engine 本体维持 wontfix。

## Grill 决策记录（2026-11-11，两轮全批）

①范围四件+两缓议 ②触发=plan 页效应每材料每挂载一次 ③照常吃 DailyCap 将尽即停显式呈现 ④讲解**替换**问AI导师 ⑤讲解常显+去学习维持隐藏+计算摘要 ⑥失败=会话内 guard ⑦静默开始/成功仅失败 toast ⑧短标签短预填 ⑨nodeId 逐轮+抽屉会话记忆 ⑩硬化四件含重试计额度。

## Tickets

| # | Ticket | Blocked by | 交付 |
| --- | --- | --- | --- |
| 01 | [t01-provider-hardening](t01-provider-hardening.md) | None | seam 不再被 JSON 琐碎与瞬时故障废掉整轮 |
| 02 | [t02-node-teaching](t02-node-teaching.md) | None（建议 01 先并） | 节点点开即有「讲」的入口，grounding 在节点 |
| 03 | [t03-auto-mapping](t03-auto-mapping.md) | None（CAP_REACHED 今日已独立成码；01 只影响传输故障文案细节） | 建完计划 coverage 自动填 + 诚实摘要 |

无硬阻塞边；一个 epic worktree（`epic/p4-34-plan-content-loop`）串行 01→02→03 落 PR，保持审查面小。

## Review-round accepted outcomes（code review 2026-11-11，T4 fixes）

- 传输故障 detail 到 toast 文案 —— deferred（spec decisions 2/17 sanction：对外失败码不变，detail 仅 context 可读）。
- teachBadge + sheet 打开讲解时自动关闭 —— accepted，作为小 UX additions 保留。
- 手动「AI 映射」按钮仅在该材料自己的 auto run 进行中禁用（anti-double-spend；grill intent = 显式重试独立于自动化，其余时刻永远在场）。
- `VITE_API_PROXY_TARGET` —— 由 AGENTS.md 的 parallel-worktree port-override practice 背书（default :3000 不变）。
