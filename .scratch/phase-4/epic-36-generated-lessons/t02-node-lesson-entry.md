# 02: 节点讲义入口 —— ②端到端（节点一键 → reader 逐小节就绪）

**What to build:** 节点 sheet「AI 讲解」旁并列**独立**的「生成讲义」动作（testid `node-lesson`）：mapped 节点可点（入口显示模板推导的预计消耗 + 今日剩余额度）；unmapped 节点禁用 + 一句诚实理由（「该节点尚无映射材料」——常显姿势与 AI 讲解一致，映射依赖可见）。点击 = CreateLesson → 导航 `/read/:lessonId` 直达 reader。**reader 即进度面**：Material.generation 存在时，outline 小节渲染为占位卡（pending 灰 / 当前小节流式 spinner+文本渐现 / ready 即正文，MarkdownFlow 合并渲染已就绪 sections）；顶栏暂停条（cap「明日续」/provider 两态文案）+「继续生成」（新票据只补欠账）+「重新生成」（原位替换、重烧额度、二次确认）。SSE 消费走 sse-client `startStream`（新 request 类型 LessonStreamRequest {lessonId}），section_ready 驱动材料 refetch；resetApiClient 终止器照登记。节点已有讲义时动作变形为「打开讲义」（不新建界面）。普通材料（无 generation 字段）渲染路径零改动。quiz/标注在已就绪小节上即刻可用（材料身份的自然结果，无特判）。

**Blocked by:** 01（引擎+op+schema 是全部依赖面）。

**Status:** ready-for-agent

- [x] NodeActions「生成讲义」与 AI 讲解并列独立；mapped 可点（含成本+剩余额度提示）/ unmapped 禁用+理由；已有讲义 → 「打开讲义」；light+dark 双模式核验
- [x] 点击 → createLesson → 导航 reader；生成中刷新/断线不丢已就绪小节（服务端原子落盘的自然结果——UI 侧验证重进恢复进度）
- [x] reader 讲义态：占位卡三态（pending/流式中/ready）、顶栏暂停条（cap/provider 文案区分）、「继续生成」新票据只补欠账、「重新生成」二次确认原位替换
- [x] lesson 流 hook：票据 payload {lessonId}、事件驱动 refetch、resetApiClient 终止器登记；普通材料路径零改动（无 generation 字段分支不存在）
- [x] 已就绪小节上标注/quiz 可用（复用现有面，无特判代码）；小节尾来源行渲染 + 点击跳原文 reader（`/read/:materialId`，锚点定位既有）
- [x] i18n：新键全 zh/en 点式（full-parity CI 绿）；成本文案与估算函数同源
- [x] Tests：NodeActions userEvent 两态+变形；reader 讲义态组件测试（占位/暂停条/续/重生成）；lesson hook（payload/事件→refetch/终止器）；typed-hooks 层 mapper 测试（generation 视图形状）
- [x] Gates：tsc/eslint/vitest --coverage/vite build 全绿 + rspec 不回退；e2e 既有 24 段零回归（1 败=hub-tails 已知环境 flake，T1 tip 复现验证非本票回归）
