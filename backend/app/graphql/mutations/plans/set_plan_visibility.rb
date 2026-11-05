# frozen_string_literal: true

module Mutations
  module Plans
    # setPlanVisibility (FR-38, epic P2-11 T1): the plan settings surface's
    # visibility flip — thin per AD-12: authorize → command → map. The whole
    # law lives in ::Plans::SetPlanVisibilityCommand: closed-enum
    # VALIDATION_FAILED, the uniform NOT_FOUND matrix (unknown / foreign /
    # malformed plan ids — AD-13), and idempotency (same state → the
    # unchanged row, updated_at untouched). A verb-first op next to
    # updatePlan (which carries visibility in its patch) because the flip is
    # a named, disclosable product action (the Square opt-in), not a field
    # patch. Deliberately NOT an overload of updatePlan: the flip's UI is a
    # confirm-gated control, and T3's Square/fork reads ride the model-level
    # publicly_visible scope this op governs.
    class SetPlanVisibility < BaseMutation
      description "Set a study plan's visibility (FR-38): \"private\" or \"public\". Public shares the plan's STRUCTURE only — never materials, annotations, or scores. Idempotent: setting the visibility the plan already carries returns it unchanged. Unknown, foreign, or malformed plan ids are NOT_FOUND."

      argument :plan_id, String,
               required: true,
               description: "The plan's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :visibility, String,
               required: true,
               description: "\"private\" (the default, removed from the Square) or \"public\" (the Square opt-in — structure only)."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The plan after the visibility change (itself on a same-state set)."

      def resolve(plan_id:, visibility:)
        command_result(::Plans::SetPlanVisibilityCommand.call(
          current_user: current_user!,
          id: plan_id,
          visibility: visibility
        ))
      end
    end
  end
end
