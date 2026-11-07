# T4 — Nav riders (audit #11 + #12)

Milestone: Phase 2 — post-deadline
Status: done
Epic: epic-25-tutor-thread-tails
Blocked by: T3 (serial lane)

## AC

1. **#11 reader back label flicker**: the plan-origin back label shows
   `reader.backToPlan` (返回计划) while planQuery is in flight, then swaps to the
   topic. Fix: label the plan origin with `reader.backToPlan` until the topic lands
   is the FLICKER — instead prefer the sourceBack label when the origin is recorded
   (2026-11-07's recorder already covers hubs), and for a plan origin render a
   stable skeleton-width placeholder (or the topic query's data with a stable
   min-width) so the button never changes width/text mid-flight. Minimal, honest.
2. **#12 dashboard double-link**: 连续记录 KPI card re-points /planner → /analytics
   (本周学习 keeps /planner — one KPI, one hub).
3. Tests adjusted; full frontend gates green.
