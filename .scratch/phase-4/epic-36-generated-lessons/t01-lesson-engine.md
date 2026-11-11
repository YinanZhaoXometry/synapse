# 01: 讲义生成引擎 —— schema + 三命令 + 可恢复 SSE op（纯后端）

**What to build:** AI 讲义的后端全部：`materials.origin`（uploaded/generated）与 `materials.generation` jsonb 落库；`Ai::ProposeLessonOutlineCommand`（①闸门：材料→大纲 JSON，stateless 不落盘，重掷=再调一次）；`Ai::CreateLessonCommand`（统一创建：②plan+node+clientUuid（outline 内部 1 调用，unmapped 即拒绝）；①material+echoed outline+clientUuid——幂等 replay 语义照 GenerateNoteCommand 先例）；SSE op `lesson`（票据 payload `{lessonId}`，`STREAM_OPS`+检查约束迁移）：已 ready 小节跳过（**重开=只补欠账**）→ 无 outline 先出并发 `outline_ready` → 逐小节 `section_start`/token/`section_ready`（**每小节完成即落盘** sections+generation.outline.status）→ `terminal`。中途 CAP_REACHED → 已生成保留 + `pausedKind=cap` + terminal 带码；provider 持续失败（epic-34 detail 分类）→ `pausedKind=provider`；续=显式新票据，无自动续。小节填充单遍流式（`Prompts.lesson_section`，context=该小节 assigned 源小节，ContextAssembler 预算纪律；语言走 language_directive 单点）；outline 走 complete+ResponseParser。硬顶模板常量（② outline 1+小节 4–6；① outline 1+小节 ≤8）+ 从模板导出的估算函数。**生成源池排他**：引擎取源材料时过滤 origin=generated（讲义绝不喂讲义）。讲义 sections 行 server 端可带 `anchors`（客户端 Attach 校验形状不动），MaterialSection GraphQL 类型加只读 `anchors`。GraphQL 面：Material.origin/generation 只读字段 + proposeLessonOutline/createLesson mutations。

**Blocked by:** None（可立即开工；纯后端独立验收）。

**Status:** ready-for-agent

- [ ] 迁移：materials.origin enum（default uploaded）+ materials.generation jsonb + stream_tickets.op 检查约束加 `lesson`；Material GraphQL 类型加只读 origin/generation；MaterialSection 加只读 anchors；codegen 重生成 + committed schema 更新（CI freshness gate 绿）
- [ ] ProposeLessonOutlineCommand：parsed∧有 sections 的材料才可用；返回 [{title, sourceSectionIds}]（≤8，模板常量）；stateless；cap 照常消耗；Failure 形状走既有 roster（VALIDATION_FAILED/NOT_FOUND/CAP_REACHED）
- [ ] CreateLessonCommand：②输入 plan+node+clientUuid（outline 内部生成；unmapped 节点 → VALIDATION_FAILED 带诚实理由 context；每节点至多一份——已存在则幂等返回既有）+ 材料挂 plan/attachment_scope=node；①输入 material+echoed outline+clientUuid（校验 ≤8/标题去重；每源材料至多一份）；产物 origin=generated、kind=markdown、parse_state=parsed、无 blob、sections 空起步 + generation.outline 占位
- [ ] stream op `lesson`：所有权校验（异 user → NOT_FOUND）；事件序列 outline_ready→(section_start→tokens→section_ready)×N→terminal；每小节完成即持久（断线不留半句——落盘以小节为原子）；重开票据跳过 ready 小节；CAP_REACHED/provider 失败 → pausedKind 落库 + terminal；冻结契约注释更新（事件词表）
- [ ] 接地与排他：②=node_grounding（confirmed 映射章节）；①=材料 sections 预算切片；两路源池皆过滤 origin=generated；Prompts.lesson_outline/lesson_section 落地（语言纪律单点；诚实条款——只讲所给源材料）
- [ ] 估算函数：从模板常量导出预计调用数（②/①两形状），GraphQL 面可查（供入口与确认页共用，不手写成本表）
- [ ] Tests：命令 spec（幂等 replay、unmapped 拒绝、echoed-outline 校验、origin=generated 行形状含 anchors、源池排他）；`/api/stream?op=lesson` 请求级 spec（首连含 outline_ready / 重连跳过 ready / 小节原子落盘 / cap 中途→paused+terminal / provider 失败→pausedKind）；prompt spec（接地排他 + 语言 parity）
- [ ] Gates：rubocop + rspec 全绿（SimpleCov ≥96 地板）；mastery golden vectors 不动；既有三 SSE op 契约零变化
