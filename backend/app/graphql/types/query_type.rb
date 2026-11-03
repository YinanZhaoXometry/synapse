# frozen_string_literal: true

module Types
  class QueryType < Types::BaseObject
    # The scaffold's single sanctioned query (epic-00 T02) plus the domain
    # queries landing with their epics (AD-12 command core). The Plans reads
    # (epic P2-3 ticket 01) are bare association reads, not use cases: the
    # scoping IS the logic — both resolve through the caller's own
    # association path (kickoff delta 2), so the reader cannot name a row
    # that is not theirs. Auth-guarded per delta 8 via CurrentUserGuard (the
    # same seam the mutations use).
    include CurrentUserGuard

    field :health, String, null: false,
      description: "Liveness probe: the api is up and answering queries."

    def health
      "ok"
    end

    field :plans, [ Types::StudyPlanType ], null: false,
      description: "The current user's study plans — a plain list (AD-12: Relay connections only when a list truly paginates)."

    def plans
      current_user!.study_plans.order(:created_at)
    end

    field :plan, Types::StudyPlanType, null: true,
      description: "One plan by id, detail with its node tree readable off it. A foreign or unknown id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :id, String, required: true, description: "The plan's uuid."
    end

    def plan(id:)
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a
      # foreign id gets (a malformed address must not become a 500).
      return not_found unless id.match?(Accounts::UUID_REGEX)

      current_user!.study_plans.find_by(id: id) || not_found
    end

    private

    def not_found
      raise_execution_error_for(ApplicationErrors::Failure.new(
        code: :NOT_FOUND, context: { message: "plan not found" }
      ))
    end
  end
end
