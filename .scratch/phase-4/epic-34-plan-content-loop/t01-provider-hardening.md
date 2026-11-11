# 01: Provider seam hardening（修复层 + 故障分类 + 有界重试 + 语言指令单点）

**What to build:** AI seam 在坏回复和瞬时传输故障下体面降级——模型回复提取加**修复层**（截断尾部补全、尾逗号修复）再判 nil，整轮不再死于 JSON 琐碎；传输故障分类进 Failure context 的 detail（`rate_limited | timeout | unreachable | unparseable`），**GraphQL 失败码不变**（CAP_REACHED 维持独立码，传输类维持 INTERNAL+detail）；seam 内**有界自动重试一次**（仅 timeout/unreachable/rate_limited，~2s 退避；重试照常计入 DailyCap——AD-16 单一诚实额度）；八处手写提示词语言行收敛为**单点 language directive 助手**（零行为变化）。学习者可感知：quiz/映射/笔记不再整轮报废、一次 provider 抖动不再浪费手动重点、「额度用完 / 服务不可达 / 回复不可用」读起来是三件事。

**Blocked by:** None (can start immediately; backend-only，code-disjoint from 02/03).

**Status:** in-progress — claimed 2026-11-11 by the implement-spec run; integration worktree `project-new-epic34-plan-content-loop`, branch `epic/p4-34-plan-content-loop`, ticket branch `p4-34/t01-provider-hardening`

- [ ] 提取顺序：平衡扫描 → 修复候选（截断尾部补全：闭合开放字符串/括号；尾逗号移除）→ nil；提取成功但 schema 校验失败仍走 INTERNAL 路径，绝不静默接受
- [ ] 传输故障带 context detail 四分类；对外失败码集合不变（CAP_REACHED / INTERNAL / VALIDATION_* 现状照旧）——错误枚举与前端契约零破坏
- [ ] 仅 timeout/unreachable/rate_limited 触发一次 ~2s 退避重试；unparseable 与 cap 永不重试；重试是新的 provider 调用 → DailyCap 照常计数
- [ ] `Prompts` 语言指令单点助手替换全部手写语言行；现有 prompt specs 断言零行为漂移
- [ ] Specs：ResponseParser 修复层用例（截断尾/尾逗号/干净直通/nil 路径）；Provider 按 stub-adapter 契约（override `.adapter` 不碰 transport）断言分类/重试一次/重试计额度/不重试路径
- [ ] Gates：rubocop + rspec（SimpleCov 地板）绿；frontend 无改动
