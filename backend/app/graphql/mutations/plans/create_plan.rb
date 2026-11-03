# frozen_string_literal: true

module Mutations
  module Plans
    # Create a study plan with its nodes (AD-3) — thin per AD-12: parse →
    # authorize (current_user!) → command → map. Every creation rule
    # (validation, idempotent replay, uuid ownership) lives in
    # ::Plans::CreatePlanCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class CreatePlan < BaseMutation
      description "Create a study plan with its knowledge nodes (AD-3, the Phase-1 createPlan mirror). Idempotent on clientUuid: a same-user replay returns the existing rows; a uuid owned by another user fails VALIDATION_FAILED."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied plan uuid (AD-12) — the idempotency key for the create."

      argument :topic, String,
               required: true,
               description: "What the plan studies."

      argument :goal, String,
               required: false,
               description: "The optional study goal."

      argument :visibility, String,
               required: false,
               description: "\"private\" (default) or \"public\" (FR-38)."

      argument :nodes, [Types::PlanNodeInput],
               required: true,
               description: "The plan's nodes in order — order is derived from the list position."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The created (or replayed) plan."

      field :nodes, [Types::KnowledgeNodeType],
            null: false,
            description: "The plan's nodes, in order."

      def resolve(client_uuid:, topic:, nodes:, goal: nil, visibility: nil)
        command_result(::Plans::CreatePlanCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          topic: topic,
          goal: goal,
          visibility: visibility,
          nodes: nodes.map(&:to_h)
        ))
      end
    end
  end
end
