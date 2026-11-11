# Epic 36 — generated-lessons（AI 讲义）

Milestone: Phase 4 — learning-engine season（owner greenlight 2026-11-12，parking lot「C档-mini deferred」触发）
Status: ready-for-agent
Design source: [spec.md](spec.md)（grill 两轮 12 决策，2026-11-12）· 讲义形状出处 [../deeptutor-book-engine-deep-dive.md](../deeptutor-book-engine-deep-dive.md) §11.4/§7/§9 · 结构级证据 [../deeptutor-book-engine.md](../deeptutor-book-engine.md) · Board row: [../roadmap.md](../roadmap.md)

## Scope

Owner 之问「上传的 PDF/markdown 生成独立学习材料 / 每节点生成书本内容」——**AI 讲义 = 一种生成出来的 Material，不是新界面**（§11.4 叙言兑现；parametric 书维持 wontfix）：

1. **一个接地生成引擎，两入口** —— ② 节点讲义（sheet「生成讲义」一键，源=node_grounding 的 confirmed 映射章节）先做；① 材料讲义（Materials 行动作 → 只读大纲闸门 + 重出一版 → 逐章 lazy）后做。每小节 SourceAnchor（小节尾来源行，点击跳原文 reader）。
2. **流内可恢复生成** —— 每小节完成即落盘，SSE 事件驱动 reader 逐小节就绪；断线/触顶重开票据只补欠账（DeepTutor resume 语义，我们的 /api/stream 契约承载）；paused(kind=cap|provider) 保留已生成物，续=显式。
3. **完整材料身份 + 两排除** —— 可读/可标注/quiz 可出题/Materials hub 可见；不做其他讲义的生成源、不进 Auto-mapping 提案。DailyCap 单池共享，入口显示模板推导的预计消耗。
4. **对研究假设的两处修正（探测收据，2026-11-12 探索）** —— 「Solid Queue 异步」→ 流内 SSE（Solid Queue 无按需作业模式，只有 recurring scan；绿地更大故弃）；「SECTION 两遍法」→ 单遍填充（②5–8/①≤12 次硬顶优先于文采；两遍服务的是 1200–1600 词小节，我们更短）。

词汇表已落地：GLOSSARY §Generated study content（**AI 讲义**；avoid 书/book、避免与「AI 讲解」对话动作混淆）。

## Non-goals（spec §Out of Scope — 勿重议）

- Parametric 书/整书流水线（≈250 调用，wontfix 不变）、深度档、outline 编辑器、计划级批量生成。
- 讲义内嵌 quiz/闪卡块（typed-block 体系）、讲义=讲解会话 byproduct 耦合。
- 按需后台作业基础设施、context pack 持久化、per-lesson source_quality 报告对象。
- ①入口挂进 plan 页（v1 只在 Materials 行动作；plan 侧由 ② 覆盖）。

## Grill 决策记录（2026-11-12，两轮全批）

R1：①严格接地不凭空（materials-sourced 铁律）②一套引擎两入口先节点后材料 ③讲义=完整 Material 处处同权+两排除 ④DailyCap 共享+成本透明+触顶 paused 保留+幂等+无批量按钮 ⑤与 AI 讲解并列独立（不做 byproduct 耦合）⑥epic-35 三票单集成分支。
R2：①锚=小节尾来源行+跳原文 ②reader 即进度面（pending→generating→ready 占位，SSE 驱动）③大纲只读确认+重出一版（不建编辑器）④每节点/每材料至多一份、重生成原位替换 ⑤①≤8 章模板硬顶、无深度档 ⑥unmapped 按钮=禁用+诚实理由（非隐藏）。

## Tickets

| # | Ticket | Blocked by | 交付 |
| --- | --- | --- | --- |
| 01 | [t01-lesson-engine](t01-lesson-engine.md) | None | 引擎+schema+SSE op：三命令一流、可恢复、cap 姿态、锚结构（rspec 可独立验收） |
| 02 | [t02-node-lesson-entry](t02-node-lesson-entry.md) | 01 | ②端到端：节点一键→reader 逐小节就绪、暂停条/续、讲解旁并列入口 |
| 03 | [t03-material-lesson-entry](t03-material-lesson-entry.md) | 01+02（reader 讲义态与估算函数复用） | ①端到端：行动作→只读大纲闸门+重出一版→逐章；origin chip；e2e 两段+stub provider |

串行 01→02→03，一个 epic worktree（`epic/p4-36-generated-lessons`，号取 36——35 被并行会话 notes-material-ux 占用）落 PR（epic-34 implement-spec 单集成分支流程复用：fresh-context implementer 逐票 + 双轴 code-review + 单修复轮）。
