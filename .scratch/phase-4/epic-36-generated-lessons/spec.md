# Spec — epic-36 generated-lessons（AI 讲义 / C档-mini 兑现）

Status: ready-for-agent · Spec date: 2026-11-12 · Pipeline: `/grill-with-docs`（两轮 12 决策共识，2026-11-12，parking lot「C档-mini deferred」触发）→ 本 spec → `/to-tickets`
Vocabulary: GLOSSARY.md §Generated study content（AI 讲义 — 本 spec 落地时新增）
Evidence base: `.scratch/phase-4/deeptutor-book-engine.md`（C档证据与三可借零件）、`.scratch/phase-4/deeptutor-book-engine-deep-dive.md` §7/§9/§11.4（状态机/成本硬数字/讲义最小正确形状）、`.scratch/phase-4/synapse-plan-to-learning-flow.md`（before 基线，§1 已被 epic-34 部分更新）

## Problem Statement

epic-34 补齐了「有了计划→开始学」的编排（自动映射 + AI 讲解入口），但「学」的本身仍是两选一：**读自己上传的原始材料**（干、长、结构是作者的 不是学习者的），或在 Companion 里**聊**（即时但不落盘、不可复读、不可标注）。owner 的原话体感：希望「上传的 PDF/markdown 能生成一个单独的学习材料」「每个节点生成不同的书本内容」——要一层**为自己的掌握而重组的讲解层**，读完还能顺着锚点回到原文。

## Solution

**AI 讲义 = 一种生成出来的 Material，不是新界面**（deep-dive §11.4 叙言的兑现）。一个接地生成引擎、两个入口：

- **② 节点讲义（先做）**：节点 sheet「生成讲义」（与 AI 讲解并列、独立）→ 一键创建 pending 讲义（源=该节点 confirmed 映射章节，node_grounding 现成）→ 直接进 reader，小节逐个生成（SSE 流内、占位→就绪）。
- **① 材料讲义（后做）**：Materials 行动作「生成讲义」→ 先出**只读大纲**（章节列表+每章源小节+成本估算，「重出一版」1 次调用重掷；不做编辑器）→ 确认后同样进 reader 逐章生成（lazy 逐章、不一次性编译）。

每个小节带 **SourceAnchor**（小节尾来源行，点击跳原文 reader）。生成物是完整 Material：可读、可标注、quiz 可从中出题、Materials hub 可见——两条边界：不做其他讲义的生成源、不参与 Auto-mapping 提案。额度共享 DailyCap：入口显示预计消耗与剩余；触顶→讲义 `paused(kind=cap)` 保留已生成部分，显式续；每份幂等（重生成=原位替换重烧）。全程 evidence-only 不动（ADR-0001）：读讲义不是证据，测验仍是唯一证据源。

**工程形态（对研究假设的两处修正，探测收据见 epic.md）**：不引入按需后台作业（Solid Queue 无此模式）——生成为**流内可恢复**：每小节完成即落盘，断线/触顶后重开=新票据只补欠账小节（DeepTutor resume 语义，我们的 SSE 契约承载）；单份调用数模板推导硬顶（②5–8、①≤12），小节填充单遍（弃两遍法——预算优先于文采）。

## User Stories

**② 节点讲义入口**
1. As a learner, I want a「生成讲义」action beside「AI 讲解」on every mapped Knowledge Node, so that one click turns my mapped sections into a studyable lesson.
2. As a learner on an unmapped node, I want the action disabled with an honest reason (「该节点尚无映射材料」), so that the mapping dependency is visible and nothing is generated from thin air.
3. As a learner, I want clicking it to create the lesson and drop me straight into the reader with sections generating live, so that I see progress the moment I commit.
4. As a learner, I want at most one lesson per node, so that my node sheet and materials never flood with variants.
5. As a learner who later maps new material to a node, I want「重新生成」to pick up the new sources, so that the lesson stays a function of my current mappings.

**① 材料讲义入口（大纲闸门）**
6. As a learner, I want a「生成讲义」row action on any parsed material (markdown or PDF), so that a whole document becomes one standalone study lesson.
7. As a learner, I want an outline preview before anything is written (chapters + each chapter's source sections + estimated cost), so that I confirm direction before spending budget.
8. As a learner, I want「重出一版大纲」as the cheap alternative to an editor (1 call), so that dissatisfaction costs one call, not a UI lesson.
9. As a learner, I want outline chapters capped (≤8) with cost derived from the template, so that one lesson can never eat my day.
10. As a learner, I want the confirmed outline to generate chapter-by-chapter as I read, so that I pay as I go, not all at once.
11. As a learner, I want at most one lesson per source material, so that regeneration replaces in place instead of piling up.

**生成体验（reader 即进度面）**
12. As a learner in the reader, I want pending sections shown as placeholders with the active one streaming, so that the lesson assembles itself in front of me.
13. As a learner, I want a dropped connection to keep what was generated and offer「继续生成」, so that a network blip never burns completed work.
14. As a learner, I want completed sections to behave exactly like any material section (annotate, claim, quiz), so that the lesson is a first-class study surface.
15. As a learner, I want the lesson to appear in Materials with an「AI 讲义」origin chip and its live generation state, so that I can return to half-done lessons from the hub.

**额度与暂停**
16. As a learner, I want the generation entry to show estimated calls and today's remaining budget, so that I decide with the numbers in front of me.
17. As a learner hitting my daily cap mid-lesson, I want the lesson paused with everything generated so far preserved and a「明日续」affordance, so that cap is a pause, never a loss.
18. As a learner, I want resume to only fill the missing sections, so that I never pay twice for the same prose.
19. As a learner, I want quiz/companion and lesson generation to share the one DailyCap honestly, so that there is a single budget to reason about.

**溯源与诚实**
20. As a learner, I want each lesson section to end with a source line (《材料名》· §2.3 / 第 N 页) that jumps to the original in the reader, so that I can always verify against what I uploaded.
21. As a learner, I want generation strictly grounded in my materials (no parametric writing), so that the lesson is a re-presentation of my corpus, never invention.
22. As a learner, I want lesson content in my UI language deterministically, so that the language discipline every AI surface follows holds here too.

**身份与边界**
23. As a learner, I want to quiz from a lesson like any material, so that the mastery loop works on the re-presentation too.
24. As a learner, I want my generated lessons never used as sources for other lessons and never auto-mapped, so that generation can't compound on itself.
25. As a learner, I want deleting/regenerating a lesson to behave like any material lifecycle, so that there's no new management surface to learn.

## Implementation Decisions

**Schema（T1 迁移）**
1. `materials.origin` enum `{uploaded, generated}`（default uploaded）+ GraphQL `Material.origin`。`kind` 保持 `{pdf, markdown}` 不动（讲义恒为 markdown）；generated 材料无 ActiveStorage blob 是合法的。
2. `materials.generation` jsonb（仅 origin=generated 有值）：`{variant: node|material, sourceMaterialIds, outline: [{id, title, anchors: [{materialId, sectionId}], status: pending|generating|ready|failed}], pausedKind: cap|provider|null, generatedAt}`。reader 的生成态全部由它驱动——**不复用 parse_state**（那是客户端文件解析轴；讲义恒 parsed）。
3. 小节锚随 sections JSONB 行走（server 端写入的行可带 `anchors` 键；客户端 AttachMaterialInput 的校验形状不变），`MaterialSection` GraphQL 类型加只读 `anchors` 字段。
4. `stream_tickets.op` 检查约束 + `Ai::STREAM_OPS` 增加 `lesson`。

**生成引擎（T1，纯后端）**
5. 三命令 + 一流 op：`Ai::ProposeLessonOutlineCommand`（①闸门：material → outline JSON，不落盘，stateless）；`Ai::CreateLessonCommand`（统一创建：②输入 plan+node+clientUuid（outline 内部生成 1 调用）；①输入 material+echoed outline+clientUuid——幂等键语义照 GenerateNoteCommand）；SSE op `lesson`（票据 payload `{lessonId}`，60s TTL 单用照旧）。
6. op 行为（stream_controller，plan_companion 同款形状）：已 ready 小节跳过（resume 语义=重开票据只补欠账）→ 无 outline 时先出（②首连）发 `outline_ready` → 逐小节 `section_start`/token/`section_ready`（**每小节完成即落盘** materials.sections+generation.outline.status）→ `terminal {OK|enum}`。事件词表进冻结契约注释。
7. 小节填充**单遍流式**（`Prompts.lesson_section`，context=该小节 assigned 源小节文本，ContextAssembler 预算纪律照旧）；outline 走 `complete`+ResponseParser（epic-34 修复层受益人）；语言纪律走 `Prompts.language_directive` 单点。
8. 接地：②=node_grounding（node + confirmed 映射章节，unmapped 在创建时即拒绝——VALIDATION_FAILED，诚实理由进 context）；①=材料自身 sections 预算切片。生成的讲义绝不进任何生成源池（引擎读材料时过滤 origin=generated——Q3 边界的后端半边）。
9. Cap 语义：每 provider 调用照常过 DailyCap（seam 原子强制）；中途 CAP_REACHED → 已就绪小节保留、`pausedKind=cap`、terminal 事件带码；provider 连续失败（复用 epic-34 detail 分类）→ `pausedKind=provider`。无自动续——续=显式新票据。
10. 硬顶模板常量：② outline 1 + 小节 4–6；① outline 1（propose）+ 小节 ≤8；估算函数从模板导出（不手写成本表），入口与确认页共用。

**前端（T2 节点端到端 / T3 材料端到端）**
11. T2：`NodeActions` 加「生成讲义」（testid `node-lesson`），mapped=可点/unmapped=禁用+理由（与 AI 讲解常显姿势一致）；点击=CreateLesson→导航 `/read/:lessonId`；节点已有讲义时动作变「打开讲义」（sheet 内入口，不建新界面）。hook 照 typed-hooks 层约定，SSE 消费走 sse-client `startStream`（新 request 类型 `LessonStreamRequest`），section_ready 驱动 refetch。
12. T2：reader 讲义态——`Material.generation` 存在时：outline 占位卡（pending 灰/spinner 流式中/ready 即正文，MarkdownFlow 合并渲染）+ 顶栏暂停条（cap/provider 两种文案）+「继续生成/重新生成」。普通材料零改动。
13. T3：`MaterialRow` 加「生成讲义」行动作（parsed∧有 sections 才可用）+ origin chip + 生成中状态；确认弹层=只读大纲+成本+「确认/重出一版」；`MaterialsPage`/`⌘K` 无新导航面。
14. i18n：全部新文案走 dotted keys zh/en 全表（CI parity 强制）；生成入口成本文案用估算函数的同一来源。e2e：stub provider 增加 lesson 两个 op 的确定性应答；关键流加两段（节点→讲义 reader 就绪；材料→大纲确认→逐章）。

**Cross-cutting**
15. 零新学习流、零 mastery 语义变化、零后台作业。ADR 检查：无过线项（origin/边界/闸门皆可逆），记此不立 ADR。
16. 票据：T1（schema+引擎+op，rspec 可独立验收）→ T2（②端到端+reader 讲义态）→ T3（①端到端+e2e）。单集成分支 worktree（epic-34 流程复用）。

## Testing Decisions

Good tests assert external behavior only — command Failure/Success 形状、SSE 事件序列、渲染状态、prompt I/O 契约。**零新测试缝**：命令缝（stub adapter 契约，`.adapter` 覆盖）、流控制器请求级 spec、前端 hooks/组件（userEvent-first）全部是既有先例。

- **T1**：Propose/Create 命令 spec（幂等 replay、unmapped 拒绝、echoed-outline 校验 ≤8、origin=generated 行形状含 anchors）；`/api/stream?op=lesson` 请求 spec——事件序列（首连含 outline_ready / 重连跳过 ready）、**断线恢复语义**（小节完成即持久、重开只补欠账）、CAP_REACHED 中途→paused+terminal、provider 失败→pausedKind=provider；Prompt spec（接地材料排他——源池永不含 generated；语言纪律单点 parity）。
- **T2**：NodeActions 测试（mapped/unmapped 两态、已有讲义变形）；reader 讲义态组件测试（占位/流式/paused 条/resume 动作）；lesson hook 票据 payload 与 section_ready→refetch。
- **T3**：大纲确认弹层（只读+重出一版调用计数）；MaterialRow 入口门槛与 chip；e2e 两段走 stub provider。
- **Untouched by construction**：mastery golden vectors、既有 SSE 三 op 契约、auto-mapping 行为（前端 targets helper 过滤 origin=generated 是纯函数测试）。

## Out of Scope

- Parametric 书/整书流水线（250 调用路，wontfix 不变）；深度档（brief/deep）；outline 编辑器；计划级批量生成按钮。
- 讲义内嵌 quiz/闪卡块（DeepTutor typed-block 那套）；讲义=讲解会话 byproduct 耦合。
- 后台作业/按需 job 基础设施；context pack 持久化；per-lesson source_quality 报告对象。
- ①入口挂进 plan 页（v1 只在 Materials 行动作；plan 侧由 ② 的节点讲义覆盖）。

## Further Notes

- Grill record（2026-11-12，2 轮 12 决策）是歧义裁决权威；GLOSSARY「AI 讲义」条目为规范词汇。
- 对研究文档的两处**记录偏差**（探测收据在 epic.md）：「Solid Queue 异步」→流内可恢复 SSE（Solid Queue 无按需模式，绿地面更大）；「SECTION 两遍法」→单遍填充（预算硬顶优先，DeepTutor 两遍服务于 1200–1600 词小节，我们小节更短）。
- parking lot 行动：C档-mini deferred 行兑现为本 epic 后改写；「Book engine / living books — wontfix」行保持不动（本 spec 不做 parametric 书）。
- Board flow after this spec: `/to-tickets` 切 T1/T2/T3 + roadmap 板行 36（35 号被并行会话的 notes-material-ux 占用，2026-11-12 撞号改号）；实现按 worktree 纪律（`epic/p4-36-generated-lessons`）。
