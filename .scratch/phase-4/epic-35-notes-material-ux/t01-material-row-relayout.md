# T01 — MaterialRow 两行布局

Status: done on the integration branch — commit `a70ed70`
Epic: [epic-35-notes-material-ux](epic.md)

## Problem

`frontend/src/features/plans/PlanHomePage.tsx` 的 `MaterialRow`（~600-704 行）在右栏 320px(lg)/368px(xl)（内宽 ~288/336px）里用**单行 flex 无 wrap** 排 7 个元素：图标、标题(flex-1 truncate)、打开链接、kind chip、size、内容覆盖 pill、`MaterialScopeControls`(整个计划 chip + 钉到节点 popover)、解析状态 pill。`.pill` 是 `white-space:nowrap`，全部 flex-none → 标题压到 0、pills 溢出裁切。

epic-28 裁决右栏宽度让给 roadmap 图 —— 不加宽栏，改卡片内部布局。

## Fix

参照 `frontend/src/features/tasks/TaskHomePage.tsx:563` 的 wrap 先例，改两行：

- **行 1**：图标 + 标题（`min-w-0 flex-1 truncate`）+ 打开/继续阅读链接（flex-none）。
- **行 2**：`flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-1.5` —— 解析状态四态（reupload/failed/parsing/parsed 原样）→ `PDF · 3.6 MB` 合并单 muted span（既有 key 拼接，无新 key）→ 内容覆盖 pill → `<MaterialScopeControls/>`（flex-none 整体参与 wrap）。

约束：所有既有 `data-testid` 不变（e2e material→reader 流依赖）；`MaterialCoveragePanel` 展开区不动；TaskPage 行不在本轮。

## Acceptance

- [x] 320px 视口宽下材料卡无横向溢出/裁切，标题可读
- [x] 覆盖面板展开、scope pin/widen、reupload/重试四态全可用
- [x] PlanHomePage 测试绿；testid 不变

## Gates

门禁: tsc 0 错 · eslint 0 错(18 既有 warning) · vitest 129 files/1122 tests 全绿 · codegen 零漂移 · vite build OK · mastery vectors clean · rubocop 505 files 0 offenses · rspec 1542/0(覆盖 98.56% ≥ 96 地板) · e2e 24 passed/0 failed(worktree 栈 :3100 + VITE_API_PROXY_TARGET, 5 skipped 同 main)
