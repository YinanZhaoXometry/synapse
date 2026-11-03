# frozen_string_literal: true

module Mutations
  module Plans
    # Delete a study plan — thin per AD-12: parse → authorize → command →
    # map. The cascade (plan + nodes + materials + dependent rows, the
    # Phase-1 deletePlan semantics) lives in ::Plans::DeletePlanCommand; a
    # foreign or unknown id is NOT_FOUND (delta 2). No idempotency rule
    # applies — a delete is by-id addressing, not a client-uuid create.
    class DeletePlan < BaseMutation
      description "Delete a study plan. The plan's nodes, materials, and dependent rows (progress, threads, evidence, quiz history) go with it in one transaction — the Phase-1 cascade. Cross-user ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The plan's uuid."

      field :deleted_plan_id, String,
            null: false,
            description: "The deleted plan's uuid — for client cache eviction."

      def resolve(id:)
        command_result(::Plans::DeletePlanCommand.call(current_user: current_user!, id: id))
      end
    end
  end
end
