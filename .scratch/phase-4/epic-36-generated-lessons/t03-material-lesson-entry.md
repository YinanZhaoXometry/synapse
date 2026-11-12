# 03: 材料讲义入口 —— ①端到端（行动作 → 只读大纲闸门 → 逐章）+ e2e

**What to build:** Materials 行动作「生成讲义」（parsed ∧ 有 sections 才可用；markdown/pdf 皆可；行是链接——动作需 stopPropagation）：点击 → proposeLessonOutline（1 次调用）→ **只读确认弹层**：章节列表 + 每章对应源小节 + 模板推导成本估算 + 今日剩余额度；「确认生成」（echoed outline → createLesson → 进 reader，复用 T2 的讲义态全套）与「重出一版大纲」（再掷 1 次，替换弹层内容）。「不做编辑器」——不满意就重掷，编辑器留给真需要时。Materials hub 讲义行的呈现：origin chip（AI 讲义）+ 生成中状态（进行中/已暂停可续），半成品讲义可从 hub 回访续生成。**收尾 e2e**：stub provider（`frontend/e2e/stub-provider.mjs`）增加 lesson 两形状的确定性应答（outline JSON + 逐小节文本流）；关键流加两段——(a) 节点→生成讲义→reader 小节就绪→小节尾锚跳原文；(b) 材料→生成讲义→大纲确认→确认生成→reader 逐章就绪。门禁口径照 epic-34（compose stub 栈 + Playwright，重试 2 于 CI）。

**Blocked by:** 01（引擎）+ 02（reader 讲义态与流 hook 复用）。

**Status:** ready-for-agent

- [x] MaterialRow「生成讲义」行动作：parsed∧sections 门槛（否则禁用+理由）；stopPropagation 不触发行导航；pdf 与 markdown 皆可用
- [x] 只读大纲确认弹层：章节+每章源小节+成本估算（估算函数同源）+剩余额度；「确认生成」/「重出一版」（重掷计数入 toast 姿势——静默成功）；确认后进 reader 复用 T2 讲义态
- [x] 每源材料至多一份（重复入口 → 已存在则提示打开）；Materials hub 讲义行 origin chip + 生成中/已暂停状态；半成品从 hub 可回访续生成
- [x] 重生成入口（材料侧与 reader 侧一致语义：原位替换+二次确认+重烧）
- [x] e2e：stub provider 增加 lesson 应答（outline/小节流）；两段新关键流（节点路径/材料路径）纳入 suite；既有 24 段零回归；隔离姿势照既有（fresh 注册用户）
- [x] i18n：全部新键 zh/en（full-parity CI 绿）
- [x] Tests：弹层组件 userEvent（只读/重掷/确认/已存在变形）；MaterialRow 门槛与 chip；估算→文案同源性（单一函数两处消费）
- [x] Gates：全栈绿（codegen → tsc → eslint → vitest --coverage → build → mastery vectors stamp-insensitive diff；rubocop + rspec；e2e）；AGENTS.md 命令口径
