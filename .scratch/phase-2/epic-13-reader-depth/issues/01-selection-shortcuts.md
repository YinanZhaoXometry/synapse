# 01: Selection shortcuts — Ask Companion / Quick Test bar (FR-13)

**What to build:** text-selection bar with two one-click actions: **Ask Companion** (grounded in the selection — extends the AD-5 grounding input with selection text + position) and **Quick Test** (launches T2); works on Markdown selections and PDF text-layer selections; keyboard-reachable; UX per the spine's selection-bar pattern.

**Blocked by:** None (epic gate: 08 done).

**Status:** ready-for-agent

**Bound by:** FR-13, AD-5 (selection grounding rides the contract — UI renders, never guesses), AD-9 (keyboard-complete, both themes).

- [ ] Selection detected on md + pdf fixtures; bar appears anchored to the selection
- [ ] Ask Companion answers grounded in the selection with citation
- [ ] Quick Test entry hands the selection/section scope to T2's flow
