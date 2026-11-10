# 04: Hover chips + Sheet upgrade — actions one hover away (FR-47 UI + ask-AI handoff)

**What to build:** hovering a node shows roadmap.sh-style compact chips anchored above it — status toggles plus the three real actions — and the sheet gains a status row, the evidence bar, and the ask-AI handoff. After this ticket the full interaction surface of the new roadmap is live.

**Blocked by:** 03 (canvas + badges + data on the wire).

**Status:** done (2026-11-11)

**Bound by:** FR-47 UI (marks render; orthogonality — the chips never touch mastery); the companionAsk contract (prefill WITHOUT send — no silent AI spend; respects the daily cap); touch/tap contract (tap opens the sheet — epic-20 posture); i18n zh/en; the no-"Done" copy rule (已完成).

- [ ] Hover chips (HTML overlay anchored above the node, not SVG-internal): row 1 = 学习中 / 已完成 / 已跳过 toggles (current mark highlighted; clicking the active one clears — optimistic update via the T1 mutation with rollback on failure); row 2 = 去学习 / 节点速测 / 问 AI 导师 (去学习 keeps single-vs-multi mapping jump semantics; 节点速测 keeps the quiz href)
- [ ] Chip behavior: ~150ms hover-intent before showing; hides on pointer-leave; never shown for touch pointers (tap = sheet, unchanged) nor on keyboard focus (Enter = sheet carries the same actions); hub cards get no chips
- [ ] Sheet: Study Mark row (same three toggles + current state) above the existing score/description block; evidence bar = the list view's ●◐✕ mastery-window popover extracted into a shared component and rendered here (honest "—" when no evidence); 问 AI 导师 button with the same target as the chip; existing 去学习/节点速测 actions unchanged
- [ ] Ask-AI handoff: navigates to the mapped reader anchor + `&companionAsk=<encoded node-scoped draft question>`; CompanionPanel consumes it once on mount (ref-guarded against replays), opens itself, PREFILLS the composer without sending, and strips the param after consumption; rendered only when a confirmed material mapping exists (same condition as 去学习); zero server changes, no stream-protocol changes
- [ ] Shared status-toggle component used by chips and sheet (one seam for the mutation call)
- [ ] Tests (graph suite + reader suite): chips presence/content/toggle/clear + optimistic rollback; touch suppression; hover-intent; hub no-chips; sheet status row + evidence bar; companionAsk one-shot consumption (replay guarded, param stripped, no auto-send — composer filled, send untouched); ask-AI href shape; i18n parity keys; list view regression (evidence popover still works from its original home)
- [ ] web gates green

## Comments

- (none yet)
