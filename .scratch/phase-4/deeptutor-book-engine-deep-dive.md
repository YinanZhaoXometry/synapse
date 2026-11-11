# DeepTutor Book Engine — 实现级拆解（deep dive）

Status: research artifact · 2026-11-11 · **本文是 [`deeptutor-book-engine.md`](deeptutor-book-engine.md)（结构级 teardown / C档证据）的实现级下钻**，owner 要求「详细拆解、具体一点、看有什么可以利用」。方法：引擎核心（engine/compiler/blocks/planner/agents）逐行精读，UI 层与集成/持久层由两个探索 agent 全扫，关键行号均已核对。源：`../DeepTutor-main` v1.7.2。

先回答 owner 的原始理解：「根据你上传的材料自动生成一本书」——**对，但接地是可选的**。四路输入里知识库只是其一；不选 KB 时明说 "The book will rely on general knowledge"（BookCreator.tsx:427-447）。`textbook_struct/`（PDF 教材结构重建）与书功能**无关**（全库 grep 证实，books 模块从不 import 它）。

---

## 1. 全景：五阶段流水线 + 两个用户闸门 + 三层状态机

```
① create_book(intent, 源×4, language, depth)      ── 1 次 LLM（ideation）
     → BookProposal{title,description,scope,target_level,estimated_chapters}
     ← 用户闸门①：提案全字段可编辑（Title/Desc/Scope/Level/章数 2-12）
② confirm_proposal(edited)
     ├─ SourceExplorer：查询设计(1 LLM) → 并行 RAG 扫描(≤48 次检索,并发6)
     │   → 综合(1 LLM) → ExplorationReport 持久化，全程复用不再检索
     └─ SpineSynthesizer：Draft → Critique → Revise（2-4 次 LLM）
         → Spine{chapters[]} + ConceptGraph 一体产出
     ← 用户闸门②：脊柱编辑器（增删改排/内容类型/目标逐条编辑）+ 成本预估
③ confirm_spine(edited, auto_compile?)
     → Overview 章 0-LLM 确定性渲染 + 每章一个 pending Page shell + 入队
④ compile_page（后台 worker 逐页 / 读者打开触发 / 强制重生成——同一入口合并去重）
     ├─ SectionArchitect 规划块序列（1 次 LLM，失败落静态模板）
     └─ 逐块生成（每块 1 生成器，块后即存盘，逐块流式事件）
⑤ 读完即测 → Progress（派生不累积）→ 弱章 → opt-in 补救三件套
```

**三层状态机**（models.py:29-56）——书/页/块各有独立状态，粒度到块：

| 层 | 状态 | 语义要点 |
| --- | --- | --- |
| 书 | draft→spine_ready→compiling→(**paused**\|error)→ready; archived | `paused` 分 `user`/`provider` 两种 pause_kind，**保留一切已生成物，只有显式 resume 续** |
| 页 | pending→planning→generating→ready\|**partial**\|error | `partial`=部分块成部分块败——**故意不回队重跑**（compiler 已尽力，重跑只会重复花钱；engine.py:109-120） |
| 块 | pending→generating→ready\|error; hidden | 失败带 `failure{kind,retryable}` 元数据 |

## 2. 数据模型与持久化——纯文件，无数据库

`{workspace}/book/book_{id}/`：`manifest.json`(Book) + `spine.json` + `progress.json` + `inputs.json` + `exploration.json` + `learning_captures.json` + `log.md`(append-only 操作日志) + `pages/{page_id}.json` + `assets/`（path_service.py:424-460）。写=原子替换，读=pydantic 重校验、坏文件 log-and-skip（storage.py）。并发模型=单进程事件循环串行化（docstring 明说多 worker 需真锁）。**Synapse 若搬：PG 表天然替代，这层直接扔。**

模型层的关键字段（models.py）：
- `Book.revision`——乐观并发令牌，API 改内容前先占下一个 revision（models.py:522-526）
- `BookInputs`——创建时四路输入**不可变快照**（chat_history 存轻量消息快照而非引用）
- `Spine.concept_graph`——概念图是脊柱的一部分，一体生成（见 §4）
- `Chapter.source_anchors[]` + `Block.source_anchors[]`——**双层引用回源**：`{kind: kb|notebook|chat|web|manual, kb_name, ref, snippet≤300}`（models.py:218-226）
- `Block.params` 生成后保留——重生成/换类型不用重新推导输入（models.py:421-423）
- `QuizAttempt.is_correct: bool|None`——`None`=「看了答案但未自评」，**明确不折算为错**（models.py:487-492）

## 3. 接地：四路输入 + 一次扫描处处复用 + 诚实报告

四路（inputs.py）：① user_intent 自由文本（必填）；② 知识库（名字列表）；③ 聊天选段；④ 笔记本引用 + 题库类别/条目。当前 UI 实际都塞进 `source_refs`（书/KB/文件/会话统一选择器，`chat_selections` 等字段留空——BookCreator.tsx:136-162）。

**SourceExplorer（source_explorer.py）——全流水线唯一的检索发生地：**
- 2 次 LLM（查询设计 → 综合）夹一次并行 RAG 扫描：queries×KBs，`RETRIEVAL_CONCURRENCY=6`、`MAX_RETRIEVAL_CALLS=48` 硬顶（:54-55——注释记载未设闸时 8 KB×12 查询打出 ~100 并发的事故）
- 每查询留 4 块、每块 1200 字符；全局去重上限 96 块；综合输入取**分源轮转均衡切片**（24 块×320 字符）——理由：不同检索引擎的分数不可比，全局按分排序会让某一家独吞（:58-86）
- 产出的 `ExplorationReport{queries, chunks, summary, coverage, candidate_concepts}` **存盘**，SpineSynthesizer / SectionArchitect / 每个块生成器都读它（`BlockContext.relevant_chunks()` 关键词匹配取局部证据），不再二次检索（models.py:386-395 docstring："deterministic and far cheaper after the first sweep"）
- 失败优雅降级：exploration 挂了→脊柱只凭提案生成，日志明记（engine.py:625-648）
- **诚实报告** `_source_quality_summary`：哪个 KB 没取到证据、选了源却零块，写进 book.metadata 给管理界面（engine.py:171-216）

## 4. 脊柱合成：Draft→Critique→Revise + 概念图一体 + 确定性后处理

SpineSynthesizer（spine_synthesizer.py，max_rounds=2）：
1. **Draft**（1 LLM）：一次产出 `{concept_graph, chapters}`——**图和章一体，永不失同步**
2. **Critique**（1 LLM）：查覆盖/排序/环，返回 `{issues, verdict}`；verdict=ok 即停
3. **Revise**（1 LLM）：吸收 critique 改稿
- LLM 全挂时返回最后有效稿或最小兜底——流水线**永不阻塞**

LLM 之后是确定性后处理（零调用）：章按 `prerequisites`+概念依赖**拓扑排序**；概念图**断环**（丢 rationale 最弱的边）；**覆盖兜底**——没被任何章覆盖的概念按 Jaccard 挂到最相关章（module docstring :22-27）。

概念图的后续纪律：**建一次，永不重建**；用户删章→确定性剪枝（删悬挂节点和悬边，engine.py:143-168）——「书的前页不得与目录自相矛盾」。

## 5. 页编译：SectionArchitect 双层 + SECTION 两遍法 + 深度档

**SectionArchitect（page_planner.py）双层规划：**
- **LLM 层**：1 次调用，输入=章规格+exploration 摘要，输出块序列 JSON（type/focus/transition_in/params，≤12 块）；提示词带全类型目录+设计原则（"5-10 blocks、类型交错如好教科书、至少 1 个 section"——page_planner.yaml）
- **静态层**：`_TEMPLATES_V2` 按 ContentType 的确定性配方，**LLM 失败/关闭时兜底**。五配方（page_planner.py:73-155）：

| ContentType | 块序列（target_words） |
| --- | --- |
| THEORY | section(1200)→figure→section(1600)→callout→code→section(800)→quiz(3)→flashcards(5) |
| DERIVATION | section(1400)→animation→section(1200)→code(verify)→callout→section(1000)→quiz(2) |
| HISTORY | section(1200)→timeline→section(1500)→figure→callout→section(1000)→quiz(2) |
| PRACTICE | section(1000)→quiz(easy3)→code(scaffold)→section(1200)→interactive→quiz(hard3)→callout(pitfall) |
| CONCEPT | section(1400)→figure(mindmap)→section(1200)→flashcards→callout→figure(compare)→quiz(3) |

- 兜底再兜底：LLM 层产出空/全被滤掉→静态模板；配置的块类型全被禁→单 section(1700)（:381-391）
- **覆盖保证**：LLM 计划里一个 section 都没有→强制注入一个（:393-404）

**深度档**（models.py:86-104）：brief/standard/deep = target_words×0.5/1.0/1.6。静态模板历史值 standard≈每章 3,600 词。深度只放大 token 不增加调用次数。

**SECTION 两遍法**（section.py，长文核心）：
1. Outline（1 LLM，JSON）：`{intro, subsections[{heading,role,focus,target_words}], key_takeaway}`
2. Fill：**每个小节并行** 1 次 llm_text，各自只见自己的槽位提示词+局部 chunks
- 小节 token 预算公式：`max(1200, min(8000, words×3+400))`——注释记载平顶截断把 deep 档切在半句的教训（:37-48）

**桥接文本**：规划器给支撑块发 `transition_in` 提示，编译器在上一块就绪后补 1 次小调用（≤300 token）生成 1-2 句过渡，存进目标块 `payload.bridge_text`（compiler.py:348-398）。

## 6. 块生成器全表（13 个注册生成器；另有 7 个 Guided-Learning 类型未注册）

| 块 | 生成方式 | 关键 params / 备注 |
| --- | --- | --- |
| section | 2 遍：outline→并行填小节 | role/target_words；words×3+400 token 预算 |
| text | 1 调用 1400 tok | role；可选 RAG 接地；可被用户原位编辑 |
| callout | 1 调用 | variant: key_idea/warning/tip/common_pitfall/insight/connection |
| quiz | 走 QuestionPipeline（复用全局题库管线），事件直发书的流 | num_questions(≤8)/difficulty/question_type |
| flash_cards | 1 JSON 调用 | count 3-8；front≤300/back≤600/hint≤200 |
| figure | VisualizePipeline（svg/chartjs/mermaid 自动选）+ **确定性校验→失败 1 次定向修复→仍败则报错重试，不把坏图烤进书** | variant/focus |
| interactive | 同管线 render_mode=html；HTML 无修复 pass（整文件太大修不动），不可渲染即报错 | iframe 隔离渲染 |
| animation | Manim 视频管线；缺可选依赖时报 missing_dependency（**不进 unknown 类**，engine.py:226-242） | quality: low/med/high |
| code | 1 JSON 调用 | language/intent: example/verify/scaffold |
| timeline | 1 JSON 调用 | 结构化事件表 |
| deep_dive | 只生成「往深走」话题卡片；**子页点击才生成**（engine.create_deep_dive_subpage） | 隐藏章+parent_page link relation="deepens" |
| concept_graph | **0 LLM**：脊柱概念图确定性渲 Mermaid+章节索引（engine.py:803-832） | 只在 Overview 章 |
| user_note | 0 LLM 用户内容直通 | force 重生成也不动它 |

**生成器契约**（base.py）：`_generate → (payload, source_anchors, metadata)`；永不 raise——失败记录为 `failure{kind, retryable}`；kind 分类序（provider 拒绝最先，避免误判成 prompt 泄漏）；可重试失败由编译器**指数退避重试 1 次**（compiler.py:320-346）。llm_json 打捞链：strip thinking 前导（找**最后一个** `{`）→ 解析 → json-repair 兜底 → 仍不可用则**降推理档重试一次**（_llm_writer.py:137-200）。

## 7. 运行时工程（批量生成的状态机设计图）

- **合并去重**：读者打开/worker 到位/强制重生成三路同页请求经 `compile_page` 的 in-flight 表合并成一次运行；`asyncio.shield` 保证一个调用方断线不杀编译（engine.py:1213-1266）
- **断路器**：连续 **2** 页 provider 级失败（`systemic_failure_reason`：失败块过半是 rate_limit/provider/timeout 才算系统性）→ 整书 `paused(kind=provider, reason)`，**未生成页是资产，半生成页是垃圾**（engine.py:101-106）
- **暂停语义**：manifest 先写盘（进程死了也不会误自动续）；in-flight 页复位 PENDING；已生成物一律保留。`resume` 只重排欠账页（READY 原样），重置编译时钟
- **lazy 编译**：`confirm_spine(auto_compile=false)` = "First chapter only"——章**首次被打开才生成**；打开书时 `maybe_resume_on_open` 只救「状态说在编但没人编」（liveness 查运行时表而非 manifest），**故意不救 paused**（烧刚充的额度的事不干，engine.py:1132-1170）
- **时钟锚定**：`compile_started_at` 服务端落盘——重载页面不再重置秒表（engine.py:979-983）
- **事件流**：每书一条长寿命 bus（replay≤400 事件），`source="book_engine"`，阶段词汇表 ideation/exploration/synthesis/critique/overview/spine/page_plan/compilation/block（streaming.py）。前端：页面级事件 250ms 防抖只刷那页、书级 300ms 刷书+书架；`compilation_paused` **故意不弹 toast**（重放会给每个重连用户弹一次）
- **用户编辑保护**：只有 text/callout/user_note 可原位编辑（结构块只能重生成）；`edited_by_user` 标记让 force 重生成跳过用户改过的内容（engine.py:434-461, 128）
- **诊断三件套**：`generation_summary`（queued≠broken：worker 活着时排队页不是故障）、失败分类计数、`is_worker_live`（manifest 说 compiling 不代表真在编）

## 8. 阅读体验与学习闭环（UI 报告精华）

- **创建表单**：intent 自由文本 + 源选择器（KB/笔记本/书/题库/会话…）+ 语言（15 种含 auto）+ **深度三档**（各带一句成本提示）
- **闸门②的三个成本透明件**：页脚 `~N words · ~N min`（估算数字**从规划器模板导出**——同一来源不可能漂移，estimate.py + `/books/estimate-basis`）；块类型选择器明码「每种类型=每章一次模型调用」section 锁定必选；范围开关「全册生成 vs 只生成第一章」附两种成本说明。代码注释原话："Confirming here starts dozens of model calls. Say so first."（SpineEditor.tsx:433）
- **活动条**：全书视图顶部 46px 单行条——阶段标签+活体时钟+N/total 章+暂停/续按钮，无事时整条消失；两种暂停文案区分 user/provider（"你的供应商持续拒绝请求，余下章节原样保留而不是写一半"）
- **页阅读器状态词汇**：Planning the blocks…/Compiling page…/Queued（"本章还没写。轮到它会生成——或现在就开始"+按钮）/Partial（琥珀条列出失败块+Retry）/Generating {type}… 逐块 spinner
- **quiz 块**：行内作答、揭示答案、自评「答对了/答错了」（书面题只能读者自评）、答错提供 **opt-in**「加一份讲解+更易的一组题」（=supplement_for_weakness；注释：绝不自动——"startling and expensive"）
- **补救三件套**（engine.py:2108-2162）：pitfall callout + 讲解 text + 2 道易题，**per-topic 幂等**（重复点击返回已有，不叠份）
- **进度模型**：score/weak_chapters **从最新一次作答派生**而非累积——重答对就摘帽，「只会单向恶化的进度条没有信息量」（progress.py:19-27）；弱章=最新答错所在章，答对即除名
- **划选捕获**：选中→Save selection→带 ±120 字上下文+`/books/x/pages/y/blocks/z` 定位符→收件箱（Approve/Reject 状态机）→导出 MarginNote
- **导出**：仅 Markdown 单文件（quiz 折叠答案、闪卡表格、mermaid 原文；「转 PDF/EPUB 交给常用工具」）

## 9. 成本解剖（Synapse 决策的硬数字）

按 THEORY 模板 standard 档逐块记账：
- 页规划 1 + section×3（outline 3 + 小节填充 1200w≈4 + 1600w≈5 + 800w≈3 = 12）+ figure 1-2（+修复1）+ callout 1 + code 1 + quiz≈2-3（走题库管线）+ flashcards 1 + 桥接≈5-7 ≈ **每章 28-32 次调用**
- 书级前置：ideation 1 + exploration 2 + RAG 检索 ≤48 + spine 2-4 + overview 0
- **8 章书 ≈ 250 次 LLM 调用**；官方估算口径 45s/散文块、15s/支撑块 → 全书生成以**几十分钟**计
- 深度档不改变调用次数只放大 token；"First chapter only" 把成本改成按阅读付费
- 无配额/限流护栏在引擎内（只有断路器止损）；`can_create` 是权限闸不是预算闸

## 10. 与学习系统的接线（书如何服务教学）

- **正向**：书=可挂载的 topic source（`kind:"book"`）。每**章**变一条 TopicMaterial（≤24k chars）；**未写的章列出但标 "not written yet"——导师必须说「这章存在但还没写」而不是编内容**（topic_materials.py:101-148）。脊柱标题/目标水合为摘录（≤8k chars）
- **反向**：书页聊天带 `book_references:[{book_id, page_ids}]`，服务端把页文本拼进上下文（客户端只传 id）；`resolve_mastery_path_binding` 让挂在书上的会话自动以书为掌握路径身份
- **评估回流**：书内 quiz 作答同步进全局 assessment store（`source="book"`）——书内测验也喂掌握度
- 共享书：管理员工作区正本+读者私有 progress/captures 分层（learning_overlay.py）；乐观 revision 防两个编辑者互踩

---

## 11. Synapse 可利用清单（逐件映射，按采用成本分四档）

### 11.1 工程零件——与内容模型无关，任何 AI 调用点即刻受益

| # | 零件 | DeepTutor 出处 | Synapse 落点 |
| --- | --- | --- | --- |
| 1 | **llm_json 打捞链**：strip thinking 前导（取最后一个 `{`）→ 解析 → json-repair → 降推理档重试一次 | _llm_writer.py:137-200 | 直击我们修过的 quiz JSON 打捞 hotfix（2026-11-10）。backend provider seam 加同款分层打捞+一次降参重试，所有 JSON 返回的命令（quiz/闪卡/映射/study-focus）受益 |
| 2 | **失败分类 + retryable 标志 + 退避重试一次** | base.py:38-85, compiler.py:320-346 | Ai::Provider 错误面：quota/auth/rate_limit/provider/content 分类决定是否值得重试；命令 Failure 值不再静默（epic-07 的坑） |
| 3 | **语言纪律单点**：唯一 chokepoint 给 system prompt 追加严格语言指令 | _llm_writer.py:31-51 | 双语产品的真问题（zh 提示词里全是英文 token 名时会漂移）。backend 组装提示词处加一处 |
| 4 | **预算公式 words×3+400（CJK 宽松比）** | section.py:37-48 | 任何生成文字量的命令按需求字数推 token 上限，防平顶截断半句 |
| 5 | **幂等提交键**（quiz submission_id 复用即拒绝） | progress.py:82-94 | recordEvidence/闪卡 rating 的天然幂等护栏 |

### 11.2 A档增强——计划→学习闭环直接吃进

| # | 零件 | 说明 |
| --- | --- | --- |
| 6 | **ExplorationReport 模式（一次接地、持久化、处处复用）** | Synapse 版：materials 的 sections 全文在库（比 DeepTutor 还富，无需 RAG）。A档自动映射时**一次**组装 per-plan 上下文包（节点表+章节全文+映射结果）存库；后续 quiz 生成/companion grounding/讲解全读它。省钱、确定、可测试。context_assembler 从「每次现拼」升级为「拼一次大家读」 |
| 7 | **source_quality 诚实报告 + "not written yet" 条款** | 映射跑完落一份 `coverage 质量`（哪个材料零命中、哪些节点无对应章节）进 plan；companion 对无覆盖节点明说没材料禁编造；UI 形态参考其 HealthBanner（"这本书没读你的材料"级别的警告）。与流程基线 §5.2 诚实条款同一件事，这里补齐了后端+UI 两半 |
| 8 | **估算从源头导出（estimate-basis 防漂移）** | 不手写成本表——从真实模板/参数算。Synapse 的 AI 调用是 cap-counted 单发，暂无需 UI 估算；但若做任何批量，这是唯一正确的估算法 |
| 9 | **补救三件套（幂等、opt-in）** | 错题条目 →「加一份避坑讲解+更易的 2 题」。对接 mistakes hub / epic-31 adaptive review 的自然升级位。学它两点：per-topic 幂等防双击双付费；**绝不自动**（"startling and expensive"） |
| 10 | **quiz 自评三值语义** | `is_correct: None ≠ false`——揭示未评分不折算错误。Synapse 开放题若引入自评（FR 未来位），直接抄语义 |

### 11.3 形态参考——B档（per-node 教学）如果做

| # | 零件 | 说明 |
| --- | --- | --- |
| 11 | **脊柱合成器三连**：Draft→Critique→Revise + 图章一体 + 确定性后处理 | Synapse 创建聊天现在是单发提案。若要提质：+2 次调用换一次评审（覆盖/排序/环检查）；**概念图与节点一体生成**保证 roadmap 脊柱与 edges 永不失同步（我们 epic-16 自研 SVG 已经是 Synapse 版概念图，缺的是生成时的一体性）；拓扑排序+断环可以直接搬进 plans 领域逻辑（零 LLM 成本） |
| 12 | **SECTION 两遍法**（outline→并行填小节） | per-node 讲义的正确生成形状：先小节大纲后并行填——**单节点 5-8 次调用封顶**，不是整章 30 次 |
| 13 | **lazy 生成 + 缓存**（首次打开才编译，First-chapter-only 档） | 与 FR-36 in-flow generation 同哲学的教科书执行：按需付费、读时生成、生成一次缓存 |
| 14 | **deep_dive 卡片**（列话题、点击才展开子页） | 「讲解」入口的自然延伸：companion 建议的深挖话题→用户点→才生成。in-flow 的极致形态 |

### 11.4 若做「C档-mini」——节点讲义的最小正确形状（供决策，非建议）

上一轮 C档 REJECT 针对的是**整书流水线**。若 owner 想要「AI 生成学习内容」，DeepTutor 代码里藏着一条更小的路，且**不与 Synapse 哲学冲突**：

> **节点讲义 = 一种生成出来的材料，不是新界面。**

- 复用 A档 全部管线：映射确定节点↔章节后，讲解生成器吃 `node + mapped sections`（node_scope 现成）
- 形状=单节点 SECTION 两遍法（5-8 调用）+ SourceAnchor 引用**用户自己的材料章节**（生成物必须可溯源回上传材料——这是与「AI 凭空写书」的本质区别，也是 DeepTutor 的 `mastery_prepare_lesson` 验证式讲义的近亲）
- 产物挂成节点的一种 material：学习入口仍是 reader/讲解/quiz，mastery 仍 evidence-only——**不新建学习流，不碰 ADR-0001**
- 状态机抄 §7 词汇（pending/generating/ready/partial + paused-with-reason）；Solid Queue 异步 + SSE 进度（我们两样都有现成基础设施）
- 成本上限天然存在：每节点一次、幂等、可重生成
- **何时考虑**：A档 落地后若 owner 仍觉得「读原始材料太干、需要一层讲解」再做；它也可只作为 B档 讲解会话的 byproduct（讲完自动沉淀讲义）

### 11.5 明确不搬

- **整书多章流水线**（8 章≈250 调用/几十分钟；产品方向相反——前作 §6 判决不变，owner 已读）
- 文件存储层（PG 表替代）；WS 双通道（我们 SSE 契约已冻结）；共享书权限层（Square fork 是我们的模型）
- Manim 动画/交互 HTML 块（重依赖；jsdom/课程项目不适配）；KB 漂移检测（我们材料是持久快照，无漂移面）
- 桥接文本（我们页面粒度不同，收益小）

## 12. 决策钩子

- 11.1（工程零件 1-5）+ 11.2（A档增强 6-7）可以**搭 A档 的车**一起开票——它们都在同一条链路上（provider seam + 自动映射 + 诚实条款）。
- 11.3 只在 B档/epic-29 开工时取用；11.4 是独立决策位，建议顺序：**A档 先行，讲义后议**——A档 落地后「没有学习内容」的体感已消，届时再判断是否真需要生成层。
- 本文与四篇前作的关系：`deeptutor-comparison`（总览）→ `deeptutor-uiux-comparison`（UI/UX）→ `deeptutor-book-engine`（结构级/C档证据）→ `synapse-plan-to-learning-flow`（我们的 before 基线）→ **本文（实现级下钻 + 逐件可利用映射）**。
