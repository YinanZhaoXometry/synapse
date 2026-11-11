# T03 — 笔记生成 prompt 教学法升级

Status: done on the integration branch — commit `ac06dba`
Epic: [epic-35-notes-material-ux](epic.md)

## Problem

`backend/app/lib/ai/prompts.rb` 的 `Ai::Prompts.note`（185-205 行）只管结构 + 字数 + marker 契约，缺教学法取向。owner 指定参照 nz-obsidian-notes-creator skill。

## Fix

prompt 文本升级（**保持契约不变**：#1 标题开头、字数带常量 800/1000/1200、`[[enrich]]` marker 契约、language_directive、仅 markdown 输出、NFR-1 只读来源法）：

- **教而非摘要**：概念先动机/直觉、后形式化；前提与假设显式（skill §2）。
- **worked example**：材料允许时至少一个分步完整例子 + 结果独立校验一步（skill §3）。
- **表示选择**（skill §4 按渲染器裁剪）：对比优先 GFM 表格；结构/流程用代码围栏 ASCII；**数学纯文本/Unicode 行内、禁 LaTeX 源码**（markdown-view 无 katex）；**禁 mermaid 围栏当图**（不渲染）；真图只落 `[[enrich]]` marker。
- **诚实标注**：材料含糊/先修依赖处明说，不编造补齐。
- **深度优先**：装饰与长度不是质量（skill 开篇），字数带不变。

同步：`generate_note_command` spec 逐字节 pin 的 T1 prompt 字符串（prompts.rb:183-184 / generate_note_command.rb:170-172 注释所指）+ 任何 prompts spec 断言。后端无逻辑改动。

## Acceptance

- [x] rubocop + rspec 绿（含覆盖率地板）
- [x] 新 prompt 产出实测：worked example、表格、无 LaTeX/mermaid 垃圾、marker 契约完好

## Gates

门禁: tsc 0 错 · eslint 0 错(18 既有 warning) · vitest 129 files/1122 tests 全绿 · codegen 零漂移 · vite build OK · mastery vectors clean · rubocop 505 files 0 offenses · rspec 1542/0(覆盖 98.56% ≥ 96 地板) · e2e 24 passed/0 failed(worktree 栈 :3100 + VITE_API_PROXY_TARGET, 5 skipped 同 main)

prompt pin 全串 eq 同步（generate_note_command_spec）+ prompts_spec 新增教学行片段断言（43 note specs 0 failures）。
