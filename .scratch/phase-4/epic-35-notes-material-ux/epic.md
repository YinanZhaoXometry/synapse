# Epic 35 — notes-material-ux（owner 反馈轮）

Milestone: Phase 4 — learning-engine season（owner 反馈，2026-11-12）
Status: shipped on the branch — PR open（3 票串行 a70ed70 → 07aa652 → ac06dba）
计划出处：plan-mode 探索（Explore×2 + 关键文件复核），方案经 owner 批准

## Scope

owner 三条反馈：

1. **计划页右栏材料卡横向溢出** — `MaterialRow` 在 320/368px 右栏单行塞 7 个 nowrap 元素，标题被压没。epic-28 已裁决右栏宽度让给 roadmap 图 → **不加宽栏，卡片内部改两行**（TaskHomePage 行的 wrap 先例）。
2. **笔记只能右栏内联展开** — 长笔记挤在 ~320px 栏没法学。→ **独立阅读页**（复用 `/read/:materialId` 全页范式：h-full 外壳 + 细头部 + 70ch 阅读列），行点击导航，内联展开移除。
3. **笔记生成 prompt 参照 nz-obsidian-notes-creator skill 升级** — 教学法取向（直觉先行/worked example/表格对比/诚实标注），按应用渲染能力裁剪（无 LaTeX/mermaid → ASCII 围栏 + [[enrich]] marker），字数带不动，spec 逐字节 pin 同步。

## 自裁决假设（记录于 PR）

- ① 行点击 → 独立页，内联展开移除（加 1-2 行摘要扫读）；导出按钮留在行上。
- ② prompt 字数带常量（800/1000/1200）不变——token 预算是刻意的。
- ③ 数学渲染不在本轮（无 katex），prompt 明令纯文本数学。

## Non-goals

- 右栏加宽 / 材料卡改双栏布局（epic-28 裁决不动）。
- 笔记列表独立 hub 页、per-note 单条 GraphQL read（plan union 已够）。
- 数学/mermaid 渲染管线（remark-math/katex 引入）——另议。

## Tickets

| # | Ticket | 交付 |
| --- | --- | --- |
| 01 | [t01-material-row-relayout](t01-material-row-relayout.md) | 材料卡两行 wrap，标题拿满首行 |
| 02 | [t02-note-reading-page](t02-note-reading-page.md) | `/plan/:id/notes/:noteId` 独立阅读页 + 行导航 |
| 03 | [t03-note-prompt-teaching](t03-note-prompt-teaching.md) | Prompts.note 教学法升级 + spec pin 同步 |

单 epic worktree（`epic/p4-35-notes-material-ux`）串行 01→02→03 落 PR。
