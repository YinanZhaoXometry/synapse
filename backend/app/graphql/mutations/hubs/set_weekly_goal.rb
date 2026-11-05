# frozen_string_literal: true

module Mutations
  module Hubs
    # The weekly goal setter (delta decision 3, epic P2-09 T1) — thin per
    # AD-12: authorize (current_user!) → command → map. The range law and the
    # persistence live in ::Progress::SetWeeklyGoalCommand; failure mapping
    # lives in Mutations::BaseMutation#command_result via the epic-01
    # ErrorPresenter. Settings' simple half gets the UI in T5.
    class SetWeeklyGoal < BaseMutation
      description "Set the weekly goal target (delta decision 3): evidence-producing sessions per ISO week — sessions, never minutes (SM-C3). The range 1..21 is validated server-side; outside values are VALIDATION_FAILED."

      argument :target, Int,
               required: true,
               description: "The weekly target in sessions/week (1..21)."

      field :weekly_goal, Types::WeeklyGoalType,
            null: false,
            description: "The fresh weekly-goal read after the set."

      def resolve(target:)
        command_result(::Progress::SetWeeklyGoalCommand.call(
          current_user: current_user!,
          target: target
        ))
      end
    end
  end
end
