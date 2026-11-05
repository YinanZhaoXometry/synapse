# frozen_string_literal: true

module Progress
  # The weekly goal's setter (epic P2-09 T1, delta decision 3): the target
  # persists on users.weekly_goal_target — evidence-producing SESSIONS per
  # ISO week (SM-C3: sessions, never minutes). A plain setter (no replay
  # semantics — the last write wins), validated server-side against the same
  # 1..21 range the DB check floor pins.
  class SetWeeklyGoalCommand < ApplicationCommand
    option :current_user
    option :target

    def call
      unless target.is_a?(Integer) && target.between?(WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX)
        return Failure(:VALIDATION_FAILED,
                       { message: "weekly goal target is outside #{WEEKLY_GOAL_MIN}..#{WEEKLY_GOAL_MAX}",
                         field: :target })
      end

      current_user.update!(weekly_goal_target: target)
      Success(weekly_goal: Hubs.weekly_goal(current_user, now: Time.current))
    end
  end
end
