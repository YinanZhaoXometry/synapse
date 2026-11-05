# frozen_string_literal: true

module Plans
  # The FR-38 visibility flip (epic P2-11 T1): setPlanVisibility — the plan
  # settings surface's write. Validation mirrors the plan commands' closed
  # enum (Plans::VISIBILITIES — VALIDATION_FAILED otherwise); addressing
  # follows the house NOT_FOUND matrix (AD-13): unknown, foreign, and
  # malformed ids answer uniformly NOT_FOUND — a malformed address must not
  # degrade into an INTERNAL from the uuid column comparison.
  #
  # Idempotent by law (the manual-task done-toggle precedent): setting the
  # visibility the row already carries returns the row UNCHANGED — no write,
  # updated_at untouched (no phantom activity on a double-tap or an offline
  # replay). The flip's read-path effect (the Square listing) governs itself
  # by StudyPlan.publicly_visible — T1 only owns the model-level truth.
  class SetPlanVisibilityCommand < ApplicationCommand
    option :current_user
    option :id
    option :visibility

    def call
      unless Plans::VISIBILITIES.include?(visibility)
        return Failure(:VALIDATION_FAILED, { message: "visibility is invalid", field: :visibility })
      end

      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "plan not found" })
      end

      plan = current_user.study_plans.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      return Success(plan: plan) if plan.visibility == visibility

      plan.update!(visibility: visibility)
      Success(plan: plan)
    end
  end
end
