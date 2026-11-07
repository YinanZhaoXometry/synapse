# T5 — Close: gates, board, handoff

Milestone: Phase 2 — post-deadline
Status: ready-for-agent
Epic: epic-25-tutor-thread-tails
Blocked by: T4

## AC

1. Full local gates in the worktree (tsc · eslint · vitest · rubocop · rspec with the
   worktree's own compose project + test DB).
2. `just e2e` NOT run locally (ports owned by the demo stack) — CI owns the e2e job;
   note it in the PR.
3. roadmap.md board row (epic-25) — added without committing the parallel session's
   in-flight roadmap edits (stage only the epic dir; the row rides the board's next
   commit).
4. PR → merge → **delete the worktree + branch per workflow.md § Implementation
   worktree discipline** (merge is the delete trigger).
5. Demo-facing verification note: tutor page now survives a reload with history; the
   footer shows the session identity.
