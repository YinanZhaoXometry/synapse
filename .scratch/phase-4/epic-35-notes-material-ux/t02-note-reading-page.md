# T02 — 笔记独立阅读页

Status: done on the integration branch — commit `07aa652`
Epic: [epic-35-notes-material-ux](epic.md)

## Problem

`NotesSection.tsx` 的 `NoteRow` 是 Collapsible 内联展开 —— 整篇 markdown 挤在 ~320px 右栏，长笔记没法阅读学习。

## Fix

**提取共享渲染件** `frontend/src/features/plans/NoteBodyView.tsx`：把 NotesSection 内的 `NoteBody`/`TargetingStrip`/`MarkerCard`/`NoteMarkdownSegment`（含 lazy `MarkdownView` 声明，markdown pipeline 独占 chunk 纪律 AD-8 不破）移入，导出 `NoteBodyView({ note })`。纯逻辑已全在 `note-body-shaping.ts`，不动。NotesSection import 之。

**新页面** `frontend/src/features/plans/NotePage.tsx`，照 ReaderPage 外壳：

- 根 `h-full flex flex-col overflow-hidden`；细头部（`min-h-[52px] px-4 bg-card border-b border-border-soft`）：返回（`/plan/:id`）+ 标题 + scope chip（含目标标题）+ 日期 + 导出按钮（`downloadNoteMarkdown`）。
- 内容 `flex-1 overflow-y-auto` → `<article className="reader-prose w-full max-w-[70ch] mx-auto py-8 px-6">` 包 `NoteBodyView`（weak-spot 条 + markdown 段 + marker 卡同源渲染）。
- 数据 `usePlanNotesQuery(planId)` 按 noteId find（唯一 read，无单条查询；plan 页已缓存）；加载态 + 诚实 not-found（仿 `ReaderPage.tsx:589-608`）。

**路由** `App.tsx`：懒 import + `<Route path="/plan/:id/notes/:noteId">`（RequireAuth→AppLayout→Suspense，与 `/plan/:id/quiz` 同型）。

**NoteRow 改交互**：去 Collapsible，整行 Link → `/plan/:id/notes/:noteId`；保留 scope chip/目标/日期/导出（stopPropagation）；加 1-2 行 muted 摘要（粗剥 markdown + 截断）。testid `note-row`/`note-export` 保留。

**i18n**：新 key（`notes.openPage` 等）进 `i18n-dictionary.ts` zh/en 成对。

## Acceptance

- [x] 行点击进独立页，70ch 阅读列、marker 卡、weak-spot 条、导出全可用
- [x] 直接访问未知 noteId → 诚实 not-found
- [x] NotePage.test.tsx 新建；NotesSection.test.tsx 更新为导航断言（MemoryRouter）
- [x] zh/en parity 测试绿

## Gates

门禁: tsc 0 错 · eslint 0 错(18 既有 warning) · vitest 129 files/1122 tests 全绿 · codegen 零漂移 · vite build OK · mastery vectors clean · rubocop 505 files 0 offenses · rspec 1542/0(覆盖 98.56% ≥ 96 地板) · e2e 24 passed/0 failed(worktree 栈 :3100 + VITE_API_PROXY_TARGET, 5 skipped 同 main)

NotePage.test 6 tests + NotesSection.test 9 tests（行导航断言）+ note-body-shaping.test（noteExcerpt 4 例）全绿；zh/en parity 绿。
