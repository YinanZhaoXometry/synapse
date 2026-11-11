# 02: AI 讲解 —— 节点常显 teaching 入口（替换「问 AI 导师」）

**What to build:** 每个 Knowledge Node 都有一个**永远在场**的「AI 讲解」动作（节点 Sheet + hover chip 双面），**替换**旧的映射门槛「问 AI 导师」——点开 = 打开 plan Companion 抽屉 + 短预填（zh「请给我讲解这个节点」/ en「Teach me this node」，永不自动发送）。教学轮的 grounding 切到节点：该节点的标题/描述/目标 + **它的 confirmed 映射章节**（预算截断；plan 全域材料池不进——node scope 语义既有）。追问轮在同一抽屉会话内**继续携带 nodeId**（前端会话记忆；打开普通 plan Companion 或对另一节点讲解即清除/替换；零服务端线程状态）。unmapped 节点 → companion 诚实回答「还没挂材料」并指向上传（提示词诚实条款；绝不凭参数记忆编内容）。机制：stream-ticket input 增可选 `nodeId`（仅 plan_companion op，所有权校验比照既有 mistake-entry input）；冻结的 `/api/stream` SSE 契约不动，ticket input 是唯一扩展面（向后兼容：缺字段=今日行为）。reader 内 companionAsk（划选提问/快测预填）不动。

**Blocked by:** None（建议 01 先并——失败分类 detail 让讲解轮的降级文案更细，但非硬依赖）。

**Status:** queued — claimed 2026-11-11 by the same implement-spec run (serial lane 01→02→03 in worktree `project-new-epic34-plan-content-loop`); starts after t01 merges to the integration branch

- [ ] 节点 Sheet + hover chip 常显「AI 讲解」（无映射门槛）；节点面上「问 AI 导师」消失；reader 的 companionAsk 路径行为不变
- [ ] Stream ticket 收可选 nodeId（plan_companion 专用），ownership 校验同 mistake-entry 先例；缺省 = 今日 plan 级 grounding；codegen 重生成 + committed schema 更新（CI freshness gate 绿）
- [ ] 节点轮 grounding = 单节点 + 其 confirmed 映射章节（budget 内）；plan 全域池排除；companion 提示词带诚实指令（unmapped → 明说没材料、指上传，禁编造）
- [ ] 抽屉会话记忆：同会话追问轮每轮带 nodeId；普通入口打开/换节点即清/换；无服务端新状态、无新存储
- [ ] 预填短且不自动发送；标签 zh「AI 讲解」/ en「Teach me」；i18n 走点式键 zh/en（full-parity CI 绿）；light+dark 双模式核验
- [ ] Tests：ContextAssembler 节点组装 spec（含 unmapped → 空组装+诚实旗标）；ticket ownership spec（异 plan 节点 → 既有 roster 姿态的 NOT_FOUND/VALIDATION）；node-actions userEvent 测试（常显、旧动作已替换）；plan-companion hook 测试（nodeId 逐轮携带与清除）
- [ ] Gates：两栈全绿（codegen → tsc → eslint → vitest --coverage → build；rubocop + rspec）；mastery golden vectors 不动（本票零 mastery 语义）
