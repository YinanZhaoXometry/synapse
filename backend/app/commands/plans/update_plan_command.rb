# frozen_string_literal: true

module Plans
  # Update a study plan's own fields — the Phase-1 updatePlan mirror (a patch
  # of topic/goal) plus the backend-only visibility passthrough (FR-38; the
  # Phase-1 TS shape has no visibility). The patch hash carries only the
  # fields the caller actually provided — the mutation distinguishes "absent"
  # from "explicit null" at the GraphQL boundary, so an explicit nil goal
  # clears it (Phase-1 patch semantics) while absent keys stay untouched.
  #
  # Scoping (kickoff delta 2): the row is addressed through the owner's
  # association path (user.study_plans.find_by), so a foreign id and an
  # unknown id are uniformly NOT_FOUND — never FORBIDDEN (which would reveal
  # existence).
  class UpdatePlanCommand < ApplicationCommand
    option :current_user
    option :id
    option :patch, optional: true

    def call
      plan = current_user.study_plans.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      patch = self.patch || {}
      if patch.key?(:topic) && patch[:topic].to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "topic is required", field: :topic })
      end
      if patch.key?(:visibility) && !Plans::VISIBILITIES.include?(patch[:visibility])
        return Failure(:VALIDATION_FAILED, { message: "visibility is invalid", field: :visibility })
      end

      plan.update!(patch)
      Success(plan: plan)
    end
  end
end
