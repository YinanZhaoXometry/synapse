# 03: Auto-mapping + coverage 诚实（parsed∧零映射 → 每挂载自动提案一次）

**What to build:** 带着（或后挂）已解析材料落到 plan 页，coverage **自动开始填充**——对每个「parsed ∧ 有章节 ∧ 零映射行」的材料自动调一次既有映射 mutation，每挂载会话每材料至多一次（会话 guard 为组件 ref，零持久化零新存储）。静默开始/静默成功（映射面板即界面）；失败恰好一条可行动 toast（AppError→messageKey→t() 惯例）；`CAP_REACHED` 呈现为映射面板的「今日 AI 额度已用完」状态（独立失败码今日已直达前端；绝不静默烧穿额度，下次访问自然重试）。手动「AI 映射」按钮永远在场（显式重试独立于自动化）；confirmed/rejected 决策永不被自动跑覆盖（命令层既有不变量）。映射面板新增**计算出的**「unmapped nodes: N」摘要行（从 plan 页既有 plan 级映射读派生——材料映射轴，绝不与掌握度轴 uncovered 混词）。CreationChat 确认路径**刻意不**装触发器（它立即跳转，plan 页效应落地即接住——单触发点）。e2e：stub-provider 关键流补「建计划带文件 → 自动映射行出现 → 节点讲解预填」段。

**Blocked by:** None（CAP_REACHED 已独立成码；01 只改善传输故障类文案细节）。

**Status:** queued — claimed 2026-11-11 by the same implement-spec run (serial lane 01→02→03 in worktree `project-new-epic34-plan-content-loop`); starts after t02 merges to the integration branch

- [ ] 效应：parsed ∧ sections ∧ 零映射行 ∧ 本挂载未触发过 → 每材料恰一次映射调用；CreationChat 路径不装触发器（跳转后由 plan 页效应接住）
- [ ] 会话 guard：失败后本挂载会话不再自动重试；下次访问自然重试；confirmed/rejected 行永不被覆盖
- [ ] 静默开始/成功；失败恰好一条 toast；CAP_REACHED → 面板「额度已用完」独立状态，不再发起第二次
- [ ] 「unmapped nodes: N」摘要行由既有读派生（零新查询字段）；措辞与掌握度 uncovered 严格分离
- [ ] 自动触发选材逻辑为纯 helper（materials × mappings × session-fired → targets），domain 式 vitest；plan 页集成走 mock `@/api` 惯例（AppLayout 测试同款）
- [ ] e2e stub-provider 段绿：创建带文件 → 自动映射提案行出现 → 节点「AI 讲解」预填出现
- [ ] i18n 点式键 zh/en（full-parity 绿）；light+dark 核验
- [ ] Gates：codegen、tsc -b、eslint、vitest --coverage、vite build 全绿；mastery golden vectors 不动
