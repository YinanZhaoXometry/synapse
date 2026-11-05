# frozen_string_literal: true

# The Progress context (AD-12): reading-progress persistence lives under
# app/commands/progress/ (one directory per context, epic-03 kickoff
# delta 4). The upsert keyed by the material IS the idempotency — a re-save
# overwrites cleanly (the Phase-1 saveReadingProgress shape); there is no
# client uuid on the op. The weekly goal's setter (epic P2-09 T1, delta
# decision 3) lands here too — the range is pinned twice, DB check floor +
# the command's server-side validation.
module Progress
  # users.weekly_goal_target's range (delta decision 3): sessions/week, 1..21.
  WEEKLY_GOAL_MIN = 1
  WEEKLY_GOAL_MAX = 21
end
