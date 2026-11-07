# Synapse 技术总结（报告/PPT 素材 · 中文版）

> 用途：COMP5241 学科报告与 PPT 的技术素材。速查卡结构：每张卡 = **一句结论** → 支撑细节 → 可引用数据（标出处）。
> 数字基准日：2026-11-07（main @ `1c3d6c0`）。

---

## 一、总览卡

**一句话定位**：Synapse 是一个双语（中/英）AI 引导的学习平台——系统给学习计划、用户自带材料，掌握度只由测验证据驱动；单人 + AI agent 协作，约 6.5 天从零交付的全栈monorepo应用。

| 维度 | 事实 | 出处 |
|---|---|---|
| 交付节奏 | 2026-11-01 首提交 → 11-07，约 **6.5 天 / main 分支 534 commits** | `git rev-list --count main` |
| 阶段划分 | 3 个 delivery phase · **25+ epics**（Phase1 本地静态原型 6 个；Phase2 服务器化 16 个；Phase3 优化季 10 个，7 个已交付/评审中） | `.scratch/phase-{1,2,3}/` |
| 前端栈 | Vite 5 · React 18 · TypeScript · shadcn/ui（46 组件）· Tailwind 3 · Apollo Client 4 | `frontend/` |
| 后端栈 | Rails 8.1.4（API-only）· graphql-ruby ~2.5 · puma · Solid Queue · Postgres 17 | `backend/AGENTS.md` |
| API 面 | GraphQL：**Query 35 + Mutation 43 = 78 个根操作**；schema 5,334 行 / 93 个 object type / 72 个 input | `backend/schema.graphql` |
| 后端规模 | 命令层 **65 个命令类（含基类）/ 17 个业务上下文目录** | `backend/app/commands/` |
| 测试 | RSpec 最近关板基线 **1,474** examples · Vitest **约 980+**（111 个测试文件）· Playwright e2e **26 用例 / 6 文件** | 各 epic 关板状态行 + 静态计数 |
| 覆盖率门槛 | 后端 SimpleCov 行覆盖地板 **96%** · 前端 v8 阈值 lines 65 / branches 83 / functions 77 | `backend/spec/spec_helper.rb` · `frontend/vitest.config.ts` |
| 性能 | 入口 bundle **1,026 KB → 724 KB（−29.5% min / −26.6% gzip）**，CI 设 800 KB tripwire | `.scratch/phase-3/epic-19-bundle-split/bundle-report.md` |
| i18n | **904 个词条 × 中英双语**，全表平价由专门测试钉死 | `frontend/src/contexts/i18n-dictionary.ts` |
| 设计系统 | **167 个 CSS 变量 / 8 组 token**（含学习状态语义色）· 3 调色板 × 3 模式 | `frontend/src/index.css` |

---

## 二、架构总览

### 2.1 部署拓扑（免费层四件套）

**结论：一套「静态前端 + 单容器 API + 无 Redis + 对象存储直传」的免费层架构，在设计期（架构脊柱）就已定稿。**

```
浏览器 SPA ──(Cloudflare Pages, 静态 + _redirects SPA fallback)
   │  POST /graphql（业务面）
   │  GET  /api/stream?ticket=…（SSE，AI 流式，GraphQL 外唯一例外）
   ▼
Render 单 Docker web 服务（Rails 8.1, puma + Solid Queue 同进程, health /up）
   ├── Neon Postgres 17（direct 连接，非 pooler）
   └── Cloudflare R2（材料 blobs；dev/test 用 compose 里的 minio 等价替身）
```

- 后端**总共只有 3 条路由**：`POST /graphql`、`GET /api/stream`、`GET /up`（`backend/config/routes.rb`）——攻击面与维护面极小。
- 为什么值得写：免费层约束（无 worker 进程、无 Redis、无 keep-alive）不是部署时将就出来的，而是 AD-20 在架构期就写死的信封，反向塑造了全部技术选型（见 §3.5/§3.6）。

### 2.2 前端分层（四个 seam，单向依赖）

**结论：SPA 内部是「小端口-适配器」：路由/features 只经 typed hooks 层触域数据，域逻辑纯函数化并强制测试。**

| 层 | 职责 | 关键文件 |
|---|---|---|
| `src/apollo/` | Apollo Client 4 单例：auth link + 相对 `/graphql`；`resetApiClient()` 是登录/登出/切号的**唯一**清缓存+SSE 终止通道 | `frontend/src/apollo/client.ts` |
| `src/api/` | typed hooks 层（features 唯一数据入口）：**34 个 query + 42 个 mutation 文档** → codegen → 提交的 TypedDocumentNode；服务端 mastery 字段只读不重算（AD-14） | `frontend/src/api/index.ts` |
| `src/domain/` | 纯域逻辑：mastery（ADR-0001 规则）、streak、实体、标注区间、今日/周键——**Vitest 覆盖强制**（AD-10） | `frontend/src/domain/mastery.ts` |
| `src/ai/` | AI seam：SSE 客户端 + 服务端适配器 + 模拟实现（dev/test 确定性替身） | `frontend/src/ai/sse-client.ts` |

### 2.3 后端 command-core

**结论：每个用例 = 一个命令类，resolver 退化成四步胶水；错误是闭合枚举，跨栈 1:1 映射。**

- **命令层优先（AD-12）**：`ApplicationCommand`（dry-initializer + dry-monads Result），业务逻辑从不 raise；resolver 只做「parse args → authorize → call command → map Result」；纯 SELECT 可直连用户 scope（裸读豁免），一切有决策的读写必须走命令。
- **闭合错误枚举**：`UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | RATE_LIMITED | CAP_REACHED | INTERNAL` 七码（`backend/app/commands/application_errors.rb`）→ GraphQL `extensions.code` → 前端 `AppError` 1:1 镜像（`frontend/src/api/errors.ts`）→ i18n 文案 → toast。错误处理链路全程可枚举、可测试。
- GraphQL 卫士：Dataloader 批量化、`max_query_string_tokens(5000)`、`validate_max_errors(100)`、无 Relay/node 全局 ID。
- 认证：JWT HS256、TTL 24h（`backend/app/lib/accounts/token_codec.rb`）；登录限流 10 次/60 秒。

### 2.4 架构脊柱 AD 一览（20 个稳定编号决策）

**结论：所有重大技术决策以 AD-1..AD-20 编号固化在架构脊柱里，票据必须引用 AD 编号——决策可追溯、不漂移。**

- **AD-1..11（Phase-1 静态纪）**：领域核心+双 seam 范式、模块边界与依赖方向、localStorage 单版本文档、AI seam、mastery 纯函数、客户端文档渲染、路由前门、脚手架约定、测试姿态、静态部署。
- **AD-12..20（Phase-2 服务器纪）**：GraphQL-first 命令核心、服务端数据模型、mastery 计算迁家、JWT 账号、AI 服务端执行+SSE 单面、monorepo、Apollo 切换、Solid Queue、部署信封。
- 出处：`docs/architecture/architecture-synapse/architecture-synapse.md`；A **D 编号在票据里被持续引用**（`.scratch/phase-*/epic-*/`）。

---

## 三、关键设计决策（速查卡）

### 3.1 ADR-0001：掌握度是一个纯函数

**结论：Mastery Score = 最近 5 条证据的窗口均值；证据不足 3 条封顶 99；rollup 用 floor；14 天不新鲜封顶 99——规则唯一实现、黄金向量钉死、前后端绝不各算各的。**

- 规则常量收敛在 `MASTERY_CONFIG`（window 5 / gate 3 / threshold 80 / partial 0.5 / freshnessDays 14）。
- 后端 `backend/app/lib/mastery.rb` 是**唯一**实现，被 **41 个黄金向量案例**逐 case 精确断言（`backend/spec/fixtures/mastery_vectors.json`）；前端渲染只读服务端分数（AD-14）。
- 「标记已掌握」（claim）**永不改变分数**，只有 quiz 证据改变分数——产品诚实性的技术根基。
- 4 次修订全部记录在 ADR 修正案里：`docs/adr/0001-mastery-computation.md`（accepted 2026-11-02）。

### 3.2 schema.graphql：唯一跨栈契约 + codegen 防漂移

**结论：monorepo 两栈之间只靠一份提交进仓库的 schema IDL 对齐；CI 再生成再 diff，漂移即红。**

- `backend/schema.graphql`（IDL-only，`graphql:schema:dump` 导出）是前后端唯一契约面；幂等性由专门 spec 双导出断言字节一致。
- 前端 `npm run codegen` 生成 TypedDocumentNode（输出提交，禁手改）；CI 与 `just spec` 均「再生成 + `git diff --exit-code`」——schema 漂移永远在合并前暴露。

### 3.3 AI 面：provider 中立 seam + SSE 单一流式通道

**结论：AI 能力挂在一条 OpenAI-compatible 的 provider seam 上（换供应商=改环境变量，不改代码）；流式输出走 GraphQL 之外唯一的一条 SSE 通道，用一次性票据认证。**

- 配置面只有四个环境变量：`AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_TIMEOUT_SECONDS`（与 `AI_DAILY_CALL_CAP` 家族统一）；客户端用 Ruby stdlib Net::HTTP 自实现（`backend/app/lib/ai/`，11 个文件：provider seam / client / 8k-token 上下文装配器 / prompts / 响应解析 / 标签协议拆分器）。
- **每日用量帽**：50 次/用户/UTC 日，Postgres `INSERT…ON CONFLICT` 原子计数；前端设置页显示诚实读数「今日 N/上限」。
- **SSE 票据**：`createStreamTicket` mutation 铸 60 秒 TTL 一次性 opaque ticket（在途上限 10 张）→ `GET /api/stream?ticket=…`（ActionController::Live）；事件词汇 `rung → token* → citation → terminal`，terminal code 闭合枚举；票据不可重放、错配 401；前端断线**绝不自动重连**——重新铸票=全量重启并计入当日帽。
- 为什么值得写：把「流式」这个 GraphQL 表达不了的需求收敛到唯一一条面 + 一次性票据，认证模型简单且可测试。

### 3.4 存储直传：presign 流，API 永不过文件字节

**结论：材料文件永不经过 Rails——服务端只铸预签名 URL，浏览器直传对象存储；上传/下载 TTL 分离，路由面永不挂 ActiveStorage REST。**

- 上传：`createMaterialUpload` 铸 v4 presigned **PUT**（TTL 15 分钟、签名覆盖声明的 content-type、后端单文件上限 100MB、前端 PDF/MD 校验 20MB）；key 规约 `materials/{user_id}/{uuid}{ext}`。
- 下载：按请求现签 5 分钟 presigned **GET**，永不持久化 URL（`backend/app/commands/storage.rb`）。
- dev/test 用 compose 里的 minio 做对象存储替身，prod 是 R2（4 个 `R2_*` ENV 缺失即 boot fail-fast）；「ActiveStorage REST 路由永不挂载」由 route-guard spec 钉死。

### 3.5 持久状态收敛 Postgres（无 Redis）

**结论：任务队列、调度、每日计数等一切持久状态全部收敛在 Postgres——整套系统只有「一个无状态容器 + 一个数据库 + 一个对象存储」，没有 Redis/Sidekiq/独立 worker。**

- Solid Queue **DB-backed、与 puma 同进程**（`SOLID_QUEUE_IN_PUMA=1`）：唯一命名任务 `due_scan` 每 10 分钟扫描到期复习（FR-24），worker 并发 1。
- **连接池算术**（免费层关键）：puma web 3 + queue worker 1 + dispatcher 1 = **5 = AR 连接池**，刻意不设 `RAILS_MAX_THREADS`——五个连接恰好够用，一个不多（`docs/deploy.md` §10）。
- AI 每日帽计数、登录限流同样无外部依赖。
- 为什么值得写：少一个服务 = 少一份运维/账单/故障面；备份与迁移只有 Postgres 一个单点；免费层「单 web 服务」限制下依然有后台任务能力。

### 3.6 部署前置的架构灵活性

**结论：线上形态（Cloudflare Pages · Render · Neon · R2 免费层）在写第一行业务代码前的架构脊柱里就定稿（AD-20），开发便捷与部署便捷被同等当作设计约束。**

- 免费层约束反向塑造选型：无 Redis（→Solid Queue in-process）、无 worker 服务（→单容器）、无 keep-alive（→接受 ~1 分钟冷启动；keep-alive ping + 1s 轮询会在约 8 天烧光 Neon 约 191 小时免费算力——该决策由**词法守卫 spec** 防回潮，`backend/spec/config/no_keep_alive_spec.rb`）。
- 开发便捷同等对待：根 `justfile` 单入口（`just setup/dev/up/spec/e2e`）；compose 一条命令起 postgres+minio+api；dev-only dotenv 让裸 `just up` 自带 AI；fresh 机器 README 从零到跑通。
- 附完整回滚演练手册（`docs/deploy.md` §9，回滚点 `373e138`）与 demo 账号幂等 seed。

---

## 四、重点难点（全谱系速查卡：问题 → 根因 → 解法 → 证据）

> 每张卡都可独立讲 1–2 分钟；「证据」列给出可现场打开的文件。

### 4.1 跨栈演算防漂移：黄金向量 + 剥时间戳 diff

- **问题**：mastery 规则在前端 TS 域与后端 Ruby 各有消费，如何证明两边永远一致？
- **根因**：两份实现天然会漂移；且向量 fixture 由 TS 生成器产出，fixture 里带自指的生成时间戳——任何扩向量的提交都会留下过期 stamp，朴素 diff 永远红（实际烧到两次）。
- **解法**：TS 域是**唯一真理源**，生成 41 案例黄金向量 fixture 提交；`just spec` 与 CI 均执行「再生成 → 双端剥除 stamp → diff」（stamp-insensitive），只比内容不比时间戳。
- **证据**：`justfile`（web-test recipe）· `.github/workflows/ci.yml`（"Mastery vector anti-drift" 步骤）· `backend/spec/fixtures/mastery_vectors.json`。

### 4.2 SSE 与 GraphQL 的张力：一次性票据

- **问题**：Companion 聊天、计划生成需要 token 级流式，GraphQL mutation 传不了流。
- **根因**：GraphQL over HTTP 是请求-响应模型；而 EventSource 不能带自定义认证头。
- **解法**：GraphQL 内 `createStreamTicket` 铸 60s 一次性 ticket → `GET /api/stream?ticket=` 消费；票据不可重放、错配 401；CORS 初始化器只放行这一条路径。
- **证据**：`backend/app/controllers/api/stream_controller.rb` · `backend/app/commands/ai/create_stream_ticket_command.rb` · `frontend/src/ai/sse-client.ts`。

### 4.3 ADR-0001 的三次自我纠错（TDD 抓出来的）

- **问题**：首版规则经不起边界案例——①1–2 条证据可显示 100 分；②`Math.round((100+99)/2)=100` 的平局让「100% ⇔ 全节点真掌握」不变量破裂；③新鲜度按百分比衰减语义含糊。
- **解法**：①证据门（<3 条封顶 99）；②rollup 改 `Math.floor`；③改为 14 天硬性 freshness cap（最新证据超 14 天封顶 99 且永不 mastered）。三次全部由测试/黄金向量逼出，修案记进 ADR。
- **证据**：`docs/adr/0001-mastery-computation.md`（4 段 amendment）。

### 4.4 pointerevents 隐式捕获重定向（W3C 已知缺陷）

- **问题**：触屏「双指缩放/抽屉滑动关闭」上线后出现点击被吞。
- **根因**：W3C pointerevents#356——隐式 pointer capture 会把后续事件重定向到捕获元素；且 jsdom 完全模拟不了这个行为（单测盲区）。
- **解法**：把 `setPointerCapture` 从 `pointerdown` 挪到**手势确认（ENGAGE）时刻**；补真 Chromium 触控烟测，顺手抓出入场动画重放吃 tap 的第二个 bug。
- **证据**：`.scratch/phase-3/epic-20-touch-batch/`（epic 状态行记录 W3C 编号）· `frontend/src/features/plans/`（RoadmapGraph 手势）· `frontend/src/components/layout/AppLayout`（drawer 手势）。

### 4.5 非安全上下文 UUID 崩溃

- **问题**：局域网 IP 演示（http://192.168.x.x:8080）时上传/创建操作静默失败。
- **根因**：`crypto.randomUUID` 只在安全上下文（HTTPS/localhost）存在，非安全源上是 `undefined`。
- **解法**：单一 choke point `newClientUuid()`：有 `randomUUID` 用之，否则由 16 个 `getRandomValues` 字节手工拼 RFC 4122 v4（version/variant 位置位）；6 个调用点收敛。
- **证据**：`frontend/src/lib/uuid.ts`（含单测）。

### 4.6 MinIO 镜像全渠道死亡 → 源码构建

- **问题**：本地/CI 的对象存储替身起不来——pinned minio 镜像在 docker.io / quay / ghcr / dl.min.io **全部** 401/403/410。
- **根因**：MinIO 社区发行版归档后，各 registry 的旧 tag 逐步回收，连官方 Dockerfile 都指向同一死源；叠加本地网络 DNS 污染。
- **解法**：CI 与 dev 都改为**从 pinned release tag 源码编译** minio + mc，组装仅带 curl/mc 的最小运行镜像；每阶段独立 RUN 层便于断点重试；内置 `SYNAPSE_GOPROXY` / `SYNAPSE_DOCKER_MIRROR` 双逃生阀应对污染网络。
- **证据**：`backend/.dockerdev/Dockerfile.minio` · `.github/workflows/ci.yml`（backend job）。

### 4.7 CI YAML 块标量陷阱

- **问题**：改 ci.yml 后 CI job 「0 秒变红且没有任何日志」。
- **根因**：在块标量（`run: |`）里插入的新行顶格续行，切断了块标量——YAML 语义静默变化。
- **解法/教训**：ci.yml 的任何改动先本地 python-yaml 解析验证；把「watch 显示 no checks / exit-0」当作红旗信号。
- **证据**：`.github/workflows/ci.yml`（改后已验证）；教训记录于 `.scratch/phase-3/epic-19-bundle-split/`。

### 4.8 e2e 的确定性：OpenAI 兼容 stub provider

- **问题**：CI 里跑关键流程测试不能依赖真 AI——不可复现、有费用、有网络依赖。
- **解法**：harness-only 的 **OpenAI 兼容 stub server**：按 prompts 的稳定开头行识别 prompt 形态，返回冻结应答（16 节点 roadmap 提案里故意夹一条非法回边，验证服务端校验）；quiz 题目 id 从上下文 regex 提取——编造 id 会因服务端 normalize 大声失败而非静默通过；SSE 用 `data:{json}` + `[DONE]` 模拟。
- **证据**：`frontend/e2e/stub-provider.mjs` · `backend/.dockerdev/compose.e2e.yaml`（把 provider base_url 指向 stub）。

### 4.9 先度量后拆分的 bundle 瘦身

- **问题**：入口 chunk 1,026 KB（min），pdfjs/recharts 全量随入口加载。
- **解法**：先出基线报告，再统一 idiom——**每个壳内路由在声明处 `React.lazy`**（reader/pdfjs 只在有人阅读时加载）；CI 加 dist 体积摘要 + `chunkSizeWarningLimit: 800` tripwire；顺带删除 framer-motion 死依赖。
- **结果**：入口 723,680 B（**−29.5% min / −26.6% gzip**）。
- **证据**：`frontend/src/App.tsx` · `.scratch/phase-3/epic-19-bundle-split/bundle-report.md` · `frontend/vite.config.ts`。

### 4.10 并行 worktree 的冲突协议

- **问题**：多条 epic 并行 + owner 在 main 上手工测试，端口/测试库/演示栈互相踩。
- **解法**：**实现一律在专用 git worktree**（owner 裁定，成文于 `docs/agents/workflow.md`）；worktree 从零 bootstrap（frozen 安装、独立端口、compose `-p` 独立项目名）；merge 即删 worktree+分支；维护共享冲突清单（8080/3000 端口、postgres 测试库、`just e2e`、dev 库数据）。
- **证据**：`docs/agents/workflow.md` §Implementation worktree discipline · `.scratch/` 各 epic 状态行。

---

## 五、质量保障体系

**结论：三层测试 + 三 job CI + 一族「守卫测试」，质量门禁是合并条件而不是事后检查。**

| 层 | 规模 | 门槛 |
|---|---|---|
| RSpec（后端） | 关板基线 **1,474** examples / 140 spec 文件 | SimpleCov 行覆盖地板 **96%**（红地板=红构建） |
| Vitest（前端） | **约 980+** 用例 / 114 文件 | 覆盖率阈值 lines 65 / branches 83 / functions 77（实际基线之上留 2 点 ratchet） |
| Playwright e2e | **26 用例 / 6 spec 文件** | epic-17 起为 **merge gate**；stub AI provider，无 key 无外网 |

- **`just spec` 一条链**：codegen+diff → `tsc -b` → eslint → vitest --coverage → vite build → mastery 反漂移 → rubocop → rspec。
- **CI 三 job**（push/PR to main + `epic/**`）：frontend / backend（postgres:17 service + 源码编译 minio）/ e2e（needs 前两者，失败上传 report/traces）。
- **守卫测试家族**（用测试锁住架构约定的「防回潮」机制）：
  - architecture guard：grep 断言已删的 `UserProgressContext` 不再被 import（`frontend/src/test/architecture.guard.test.ts`）；
  - route guard：ActiveStorage REST 路由永不挂载；
  - no-keep-alive 词法守卫：免费层姿态不被顺手「优化」掉；
  - i18n 全表平价：904 键 × zh/en，缺一边即 CI 红（`frontend/src/contexts/i18n-full-parity.test.ts`）；
  - schema dump 幂等、mastery 反漂移、bundle tripwire（见 §4.1/§4.9）。
- **每个 epic 双轴代码审查**（A 轴可发布性 / B 轴修复优先），发现数与修复记进 epic 关板状态行——审查本身留痕。

---

## 六、开发过程与工程方法论（重点章节）

> 本章叙事核心：**owner 把决策门，AI agent 按规格执行**——产品方向、验收、取舍全部由人拍板；实现按规格驱动链路自动执行。方法论本身也在项目中迭代（§6.1）。

### 6.1 方法论自演进：从 BMAD 全托管到双工具链分工

**结论：旧项目「一个 epic 一张大票、agent 过夜自治开发」的打法被主动淘汰，换成本项目的「BMAD 管产品思维 × Matt 链管实现」双工具链——粒度从 epic 级降到票级，反馈回路从小时级降到分钟级。**

| 维度 | v0（旧项目，BMAD-only） | v1（本项目，BMAD × Matt） |
|---|---|---|
| 票据粒度 | 1 epic = 1 个大功能点，整块交给自治 dev agent | 每 epic 拆 3–6 张纵切片票，一票一个会话收口 |
| 单次运行 | agent 跑一整晚（6 小时级）收不了口 | 单票小时级内完成，含 TDD+审查 |
| 额度消耗 | 特别快（长会话反复试错） | 可控（短会话、密集人工决策门） |
| 反馈回路 | 错误几小时后才被发现，返工成本高 | 每张票过 grill/审查，偏航当票纠正 |
| 人的角色 | 几乎旁观 | 决策门：问询应答、裁定、验收 |

- **双工具链分工**（成文于 `docs/agents/workflow.md`）：BMAD 拥有产品思维（brief → PRD → UX → 架构脊柱）；Matt Pocock skills 拥有实现（grill → to-spec → to-tickets → tdd/implement → code-review）；同一 artifact 上不跑两条链。
- **按规模选路径**：小改直奔 tdd；单特性 brief→grill→spec→tickets；大型项目才强制全架构链。

### 6.2 前期产品梳理是地基

**结论：brief → PRD（46 FR）→ UX 脊柱 → 架构脊柱（20 AD）全部在写业务代码前定稿；前期越清晰，后面越不跑偏——地基决定大楼。**

- 产品文档管线（2026-11-01 定稿）：`docs/product/brief-synapse/` → `docs/product/prd-synapse/`（46 条功能需求）→ `docs/design/ux-synapse/`（IA 表、语气表、行为圣经、**反模式清单**）→ `docs/architecture/architecture-synapse/`（20 个编号 AD）。
- **可追溯性**：每张票据引用 FR 编号与 AD 编号；PRD §6.2 ↔ 落地 diff check 在 Phase-2 开板与收板各跑一次（14 行中 10 行干净，4 行幸存者显式 reconcile 到 Deferred 表并带复活触发条件）——「不走偏」是被对账证明的，不是被声称的。
- 脊柱-vs-代码的 `gap-analysis.md` 直接产出了 Phase-1 的 epic 切片表——差距分析变成施工图。

### 6.3 设计工作流：Lovable → OpenDesign(Arc) → token 契约 → React

**结论：视觉不是画出来的，是「AI 设计工具产出规范 → 代码侧以 token 契约接收」换来的：Lovable 生成可运行的框架底座，OpenDesign 里选定 Arc 浏览器 design system 产出 Northstar 视觉，再逐 pass 映射进 shadcn/HSL token 体系。**

四步链（全部有仓库与工具侧一级证据）：

1. **Lovable 生成框架（11-01，`e3d2897`）**：按产品想法一次性生成完整可运行 SPA 底座——101 文件 / +14,969 行：shadcn/ui 50 件套、Tailwind + HSL token、13 个页面框架、i18n/主题 context。数小时内获得「能跑的起点」而非「空白仓库」。
2. **OpenDesign 选定 design system 产出 Northstar（11-02）**：在 OpenDesign（开源本地优先的 AI 设计工作台，design system 目录 150+）中选定 **Arc 浏览器 design system**（工具侧 21 个设计 run 全部绑定 `designSystemId:"arc"`，聊天记录留有 `@Arc Browser` 显式选择；对照组：前代旧项目当时激活的是另一套 claude DS）；设计 run 产出 Northstar 多屏原型（plans-home / plan-home / reader-companion / quiz 四张关键稿）与 `northstar-reference.html`（sunset/twilight/aurora 三调色板 + 暗色模式的视觉真源），导出物自带 OD-LAYOUT-PRIMITIVES 布局原语层。
3. **结构化导入（`229716d` "feat: added design system"）**：`docs/design/northstar-import/IMPORT.md` 以 **12 节、8 个 pass** 的 changelog 把 Northstar 原型逐项映射进 shadcn/HSL token——最终落地为 **167 个 CSS 变量 / 8 组**（shadcn 语义层、品牌渐变、玻璃体系、accent tint、阴影、墨水色、**学习状态语义色**（mastered/partial/citation/标注四色）、图表侧栏）。
4. **原型整体移植（`cba60ac`）**：Northstar 原型移植为 React 实现；后续演进为运行时主题系统（三调色板热切换、暗色 accent 自动提白 14%/30%）。

方法论提炼（可写进报告的两句话）：
- **AI 设计工具负责「视觉规范的生成」，代码库以「token 契约」接收**——视觉真源（northstar-import/）与行为真源（ux-synapse/EXPERIENCE.md）分离，各自单一来源。
- 工具残留同样被工程化管理：Lovable 的 tagger 插件等痕迹在 11-06 显式清除（`c24b67a`）。

### 6.4 人机分工：owner 决策门 + agent 规格 执行 + 双轴审查

**结论：人负责方向与验收（且全部留痕），agent 负责按规格实现——每个 epic 的票据、审查发现、修复、测试基线、CI run 号都记录在案，全程可审计。**

- **owner 的三类决策门**：
  1. **问询应答**：每 epic 开工跑 grill 问询轮（agent 提问+推荐答案，人拍板）；
  2. **裁定**：worktree 纪律、环境变量命名（`PROVIDER_*`→`AI_*`）、包管理器回归 npm 等关键取舍均由 owner 一句话裁定成文；
  3. **否决**：roadmap.sh 内容导入因版权许可被判 WONTFIX（不搬运、不寻求授权，外跳链接保留）——范围收敛也是决策。
- **agent 的执行纪律**：实现必须在专用 worktree；TDD；遵守根/backend 两级 AGENTS.md 架构契约；票据带验收标准。
- **双轴审查**：每个 epic 合并前跑 A 轴（可发布性）/B 轴（修复优先）两轮审查，P1/P2 发现数与修复记录在 epic 关板状态行（含分支 SHA、测试基线、CI run 号）。

### 6.5 交付节奏与看板

**结论：三 phase、25+ epic、约 6.5 天——节奏由本地 markdown 票据看板驱动，无外部工具依赖。**

| Phase | 时间 | 主题 | epic 数 |
|---|---|---|---|
| 1 | 11-02 → 11-03 | 本地优先静态原型（Nov-6 课程线） | 6（foundation/plans/reader/tasks/quiz-flashcards/small-tail） |
| 2 | 11-03 → 11-06 | 服务器化：Rails API + Apollo 切换 + 全功能落地 | 16（monorepo→api-foundation→auth→…→marking-ui） |
| 3 | 11-06 → | 优化季（不加新 PRD 范围） | 10（7 已交付/评审中：roadmap 图谱、测试加固、hub 尾巴、bundle 拆分、触屏、reader-companion UX、tutor 线程[PR #23 评审中]；3 排队） |

- 票据看板：`.scratch/phase-<N>/epic-<NN>-<slug>/` 本地 markdown + `Status:`/`Blocked by:` 行 + 五角色 triage 标签。
- 节奏要点：Phase-2 硬序列 00→01→02→03→05→08（cutover），之后功能 epic 并行开；Phase-3 单车道、每 epic 开工 delta-grill。

---

## 七、部署与免费层工程

**结论：整站跑在四家免费层上（Cloudflare Pages + Render + Neon + R2），免费层不是降级妥协，而是被显式工程化的约束集。**

- 前端：CF Pages 静态托管，`_redirects` SPA fallback，构建期唯一 env 是 API 地址。
- API：Render 单 Docker web 服务（`render.yaml`，health `/up`，autoDeploy on main）。
- **冷启动算术**：刻意不做 keep-alive——ping 循环 + Solid Queue 1s 轮询会把 Neon 约 191 小时免费算力在约 8 天烧光；接受 ~1 分钟冷启动，演示窗口前临时升付费（有完整回滚演练手册）。
- Neon 必须 direct（非 pooler）连接：Solid Queue 轮询不容忍事务级池化。
- demo 账号：每次 boot 幂等 seed（`backend/app/lib/demo_seed.rb`），演示零准备。

---

## 八、已知缺口 / 未来工作（诚实清单）

- **排队中的 epic**：闪卡翻面动效（已规格化开票）、roadmap 拖拽编辑器（最大块，压轴）、AI 提案质量两阶段提升。
- **e2e 覆盖边界**：AI 门控面（companion、开放题/mix quiz、笔记、闪卡生成）刻意不入 e2e——stub 只覆盖关键流。
- 已知体验缺口：PDF 阅读分支无双指缩放；抽屉焦点陷阱/背景滚动锁定待做；免费层冷启动 ~1 分钟；材料字节重载后缺失需手动重传（有引导）。

---

*出处速查：`AGENTS.md` · `backend/AGENTS.md` · `docs/architecture/` · `docs/adr/0001-mastery-computation.md` · `docs/deploy.md` · `docs/agents/workflow.md` · `docs/design/northstar-import/IMPORT.md` · `.scratch/phase-{1,2,3}/` · `render.yaml` · `justfile` · `.github/workflows/ci.yml`。*
