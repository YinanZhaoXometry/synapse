# frozen_string_literal: true

module Mutations
  module Plans
    # Update a study plan's own fields — thin per AD-12: parse → authorize →
    # command → map. The patch (only the fields the caller actually provided)
    # is assembled here because GraphQL distinguishes "absent" from "explicit
    # null" at this boundary: an explicit null goal clears it, an absent goal
    # leaves it untouched (Phase-1 patch semantics). All rules live in
    # ::Plans::UpdatePlanCommand; a foreign or unknown id is NOT_FOUND (delta 2).
    class UpdatePlan < BaseMutation
      description "Update a study plan's topic/goal/visibility (Phase-1 updatePlan patch semantics). An explicit null goal clears it; absent fields stay untouched. Cross-user ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The plan's uuid."

      argument :topic, String,
               required: false,
               description: "Replacement topic. Omit to leave untouched; must be non-blank when provided."

      argument :goal, String,
               required: false,
               description: "Replacement goal. Omit to leave untouched; explicit null clears it."

      argument :visibility, String,
               required: false,
               description: "\"private\" or \"public\" (FR-38). Cannot be cleared."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The updated plan."

      def resolve(id:, **args)
        patch = {}
        patch[:topic] = args[:topic] if args.key?(:topic)
        patch[:goal] = args[:goal] if args.key?(:goal)
        patch[:visibility] = args[:visibility] if args.key?(:visibility)

        command_result(::Plans::UpdatePlanCommand.call(
          current_user: current_user!, id: id, patch: patch
        ))
      end
    end
  end
end
