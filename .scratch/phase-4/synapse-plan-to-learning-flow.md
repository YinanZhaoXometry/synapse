# Synapse「计划→学习」全流程 — 代码事实 + DeepTutor 对比 + 吸收清单

Status: research artifact · 2026-11-11 · 计划内容研究第四篇（前三篇：`deeptutor-comparison.md` / `deeptutor-uiux-comparison.md` / `deeptutor-book-engine.md`，结论另见 memory `plan-content-model-research`）。流程图为当日新跑的代码级追踪（main @ `3e0b528`，epic-28 尾轮 4da79d3/c506935 之后的形态），关键锚点已逐一复核。

---

## 1. 现状全流程（从「有了计划」到「在学」）

```
创建（四条路径，全部落 /plan/:id，除任务门外）
 1a 创建聊天+文件   CreationChat → CreatePlan（客户端 uuid 幂等）
                   → 逐文件 attachMaterial（presign PUT + sessionBlobs）
                   → parseMaterial.mutate（客户端急切解析，pdf.js/md/pptx）
 1b 广场 fork      forkSquarePlan — 只复制结构（题/目标/节点/边+署名）
                   材料、映射、证据一律不带 → 到站即零材料零映射
 1c 首登导入       importDocument（Phase-1 形状，无映射概念）→ 逐材料手动 re-attach 字节
 1d 任务门         createTask（服务端自动建唯一节点）→ 直接落 /read/:materialId
        ↓
Plan Home = 编排中枢（PlanHomePage）
 左：roadmap 脊柱图（服务端 masteryScore/state 角标）/ 阶段列表切换
 右栏：attach CTA · 材料列表（打开/继续阅读 → /read/:id · 解析 chip · 映射开关）
       · 笔记区 · 快捷动作（quiz/闪卡/上传/companion 抽屉）
        ↓  ←—— ⚠ 断链③：到这里为止没有任何东西自动发生
材料→节点链路（FR-44/45，全手动）
 attach 时客户端自动 parse（急切）→ 用户手动展开映射面板（右栏，MaterialCoveragePanel）
 → 点「AI 映射章节」（mapMaterialSections，单次 cap 计数 AI 调用）
 → 提案按组 确认/拒绝（Confirm/RejectMappingProposals；confirmed/rejected 永不被覆盖）
 → 可选：SetMaterialScope 把材料钉到单节点（node_scope）或放开 plan 级
        ↓
节点动作（脊柱节点 Sheet / hover chip，node-actions.tsx 全量就这三个）
 去学习   —— 仅当 ≥1 条 confirmed 映射且章节还在；单目标直跳、多目标弹出菜单
            href=/read/:id?page=N&hl=1 或 #section-id（nodeJumpTargets, node-state.ts:86）
 节点快测 —— 永远在场；/plan/:id/quiz?nodeId= → GenerateQuiz node_scope 四路 xor 之一
 问AI导师 —— 仅当有学习链接；withCompanionAsk(readerHref, "关于《{node}》我想问：")
            = 跳 reader + companion 打开 + 输入框预填（不自动发送）
 （StudyMarkToggleRow：FR-47 自我标记，与 mastery 正交）
        ↓
Reader（/read/:materialId — Synapse 的「学习」本体就是读自己的材料）
 page-aware Companion（reading 模式，发送时读 currentPositionRef）+ 划选三件套（问/快测/标注）
 FR-15 marking：claimSection 绿标 → 该节 confirm 按钮发起 section 级快测（claim 永不是证据）
 FR-14 快测门槛 = ≥1 confirmed 映射（quick-test-gate.ts）
        ↓
Quiz / Flashcards / Mastery 闭环
 RecordEvidence（每答案一条 + 错题入库）→ payload 携新 nodes{masteryScore/state}+plan 分
 → 脊柱图角标即时更新。闪卡 rateFlashcard 永不是 evidence（ADR-0001）
```

服务端后台作业**只有一个**：`Requeue::ScanJob` 每 10 分钟重算到期错题/闪卡。没有自动映射、没有自动摄入、没有自动生成——所有 AI 都是用户手点的一次性同步调用。

## 2. 手动 vs 自动（owner「没内容」体感的量化）

| 用户必须手动做 | 系统自动做 |
| --- | --- |
| 建计划确认后逐个补挂材料（1b/1c 路径） | attach 时 presign PUT + 客户端急切解析 |
| **逐材料**展开映射面板 → 点 AI 映射 → 逐组确认 | 映射批量读进 plan 页 |
| （可选）钉 scope | 服务端 quiz 节点归因 + mastery 重算 |
| 点节点 → 三选一 | reader 定位锚点、companionAsk 预填消费 |
| companion 里**亲手按发送**（预填不算数） | 阅读位置防抖保存、深链自愈 |

从 1a「带文件建完计划」到第一次真正读上章节：创建聊天 1 次 + 映射面板 2 次点击/材料 + 节点 2 次点击，且映射入口默认折叠在右栏材料行下面。

## 3. 断链与死角

三处断链（前两篇已诊断，本轮代码复核确认）：
1. **映射手动且藏**——`mapMaterialSections` 的 hook 全库只有一个消费者（MaterialCoveragePanel.tsx:96），建完计划 coverage 恒空；
2. **无 per-node 讲解**——教学只活在 plan 级 companion 抽屉和 reader 预填里，节点 Sheet 没有第三个「讲」的入口；
3. **创建后无事发生**——无任何后台编排把 1 和 2 串起来。

死角（顺带记录）：
- 无 confirmed 映射的节点：去学习/问AI **不渲染**，只剩快测——而快测从 node_scope 生成、无材料依据（凭节点标题与描述裸生成）；
- 映射面板没有逐节手动指派 UI（只能 AI 提案 + 批量确认/拒绝，错了只能拒掉重跑）；
- plan companion 的 grounding 用 `plan_grounding` → `plan_scope`：**node-pinned 材料被排除**（context_assembler.rb:46 注释明说），钉了 scope 反而在 plan 级问答里看不见；
- companion 零材料仍照发（设计如此，服务端会明说）——但没有 DeepTutor 那条「这章还没写」的诚实条款约束它别凭参数记忆编内容。

## 4. 逐环节对比 DeepTutor（对话教学主路线；书=C 档另见 teardown）

| 环节 | Synapse 现状 | DeepTutor | 判定 |
| --- | --- | --- | --- |
| 计划怎么来 | 创建聊天提案→确认（单闸门）；映射是**事后第二闸门**但被折叠 | 大纲在对话里共创，outline 模式禁教学；`mastery_build` 要求**每个材料归属 ≥1 module 才能定稿** —— 创建期即绑定材料→节点 | DeepTutor 把绑定做成创建闸门；Synapse 把同样的东西藏成可选按钮。A 档=把它变成自动的软闸门 |
| 内容是什么 | 用户自己的材料章节 | 同：材料 manifest 每轮必带（"tutor taught from book from parametric memory alone" 是他们修过的坑） | 模型一致；断的是编排与入口 |
| 每个知识点怎么学 | 跳原文章节自己读 + companion 预填提问（要用户亲手发） | 导师对话现场教学 + on-demand `read_source` 读对应章/页；PDF 走 `mastery_prepare_lesson` 验证式讲义（引文 code-check 回原文） | gap 主体。reader companion 的 ReadingPosition 上下文 ≈ read_source 的静态版，但**没有由导师主动讲的动作** |
| 学完怎么算学会 | claim + confirm quiz → evidence-only mastery（更严） | 教完即测 → 引擎门控 | 已对齐，Synapse 更诚实 |
| 空洞防护 | 无映射节点→入口直接隐藏；零材料 companion 照发 | 「这章存在但还没写」**诚实条款**——导师必须明说，禁止编造 | 值得整条吸收成 companion 行为规则，不靠藏入口 |
| 生成基础设施 | 单次 cap 计数同步调用 | 书引擎：队列+断路器+paused+resume（teardown §4） | 姿势备用，当前无批量场景 |

书引擎（C 档）与本流程的关系一句话：**书是替代内容源，不是 per-KP 讲义**——就算整条搬来也不回答 owner 的问题（teardown §5-6 已论证拒绝）。

## 5. 吸收清单（按层）

### 5.0 已经对齐、不用动
材料即内容（不生成新文本）、evidence-only mastery、read-along 上下文（ReadingPosition）、roadmap 脊柱 ≈ concept_graph（teardown §7.3 互证）、映射提案→人工确认的姿态本身。

### 5.1 A 档两半（推荐，代码锚点就位）
1. **自动跑映射**：attach+急切解析成功且该材料零映射行 → 自动调 `mapMaterialSections` 一次（hook 现成，MaterialCoveragePanel.tsx:96 同款；提案落 `proposed` 态、confirmed/rejected 永不被覆盖 → 自动跑安全）。触发点：CreationChat.tsx:218 / PlanHomePage.tsx:158 解析成功回调，或 plan 页加载时发现「parsed 且零映射」补跑一次。成本不变（本来就是单次 cap 计数调用）。
2. **节点「讲解」入口**：节点 Sheet/`node-actions.tsx` 加第四个动作 = companion 预填节点+映射章节上下文。注意**不能只做前端预填**——stream ticket 现只有 `mistakeEntryId`（schema.graphql:1027），plan companion grounding 走 `plan_grounding`（plan 级、node-pinned 材料反被排除）。正确做法：stream input 加可选 `nodeId`，服务端改用**现成的** `node_scope`（context_assembler.rb:58，FR-44 语义已写好：plan 池+本节点钉扎材料+confirmed 映射）拼 grounding。改动小、全是拼装既有零件。

### 5.2 姿态级吸收（不建流水线也值得借）
- **诚实条款**：companion 提示词层加「节点无 confirmed 映射时明说『这个节点还没有挂材料』，不得凭记忆编内容」——比藏入口健康（入口隐藏的副作用：用户以为坏了）。
- **创建期绑定 vs 软自动**：DeepTutor 的 `mastery_build` 是硬闸门（不绑定不定稿）；Synapse 材料可后挂、计划可无材料，硬闸门不适配——A 档的「解析成功即自动提案」是正确的软版本，此处记录不照抄的理由。
- **`mastery_prepare_lesson` 的验证式讲义**（引文 code-check 回原文）：B 档若做 per-node teaching，这是「生成但可验证」的中间路线模板——唯一一种 Synapse 语义下可接受的「生成讲义」，留作 epic-30 explain-to-clear 的素材。

### 5.3 明确不吸收
book engine 整条（产品方向相反 + 成本 + 不回答本题）——证据链已闭环在 `deeptutor-book-engine.md` §6。

## 6. 决策钩子

A 档 = 5.1 两半，开 epic-33 T5 或小 epic（无领域模型变更，前端编排 + 一个 stream input 字段 + grounding 换 scope）。5.2 第一条（诚实条款）可以顺手搭 A 档的车。B 档素材（node_scope 教学会话、验证式讲义）挂 epic-29/30 板行待用。本文档为流程基线：后续任何「计划→学习」改动的 before 图以 §1 为准。
