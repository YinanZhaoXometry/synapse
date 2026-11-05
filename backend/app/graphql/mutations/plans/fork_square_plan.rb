# frozen_string_literal: true

module Mutations
  module Plans
    # forkSquarePlan (FR-39 web half, OQ-12, epic P2-11 T3) — thin per AD-12:
    # authorize (current_user!) → command → map. The whole law lives in
    # ::Plans::ForkPlanCommand (structure-only copy, the public-scope source
    # resolution with its uniform NOT_FOUND, the empty-shell refusal, the
    # delta-3 idempotency triad); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    # AUTHENTICATED by design (delta decision 5): unlike the T2 squarePlans/
    # squarePlan public reads, adopting requires an account — the fork lands
    # a private plan in the caller's own library.
    class ForkSquarePlan < BaseMutation
      description "Adopt a public Square plan (FR-39, epic P2-11 T3): copy its STRUCTURE ONLY — topic, goal, and node title/stage/order — into a new PRIVATE plan owned by you, with the attribution fields set (forkedFromTopic). No materials, annotations, scores, or progress carry over, and nothing writes back to the source. The source answers only through the public scope: a private, unknown, or malformed source id is NOT_FOUND. A zero-node source is refused (VALIDATION_FAILED). Idempotent on clientUuid: a same-user replay returns the existing fork; a uuid owned by another user fails VALIDATION_FAILED."

      argument :source_plan_id, String,
               required: true,
               description: "The public source plan's uuid (from squarePlans/squarePlan). A private, unknown, or malformed id is uniformly NOT_FOUND."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied plan uuid (AD-12) — the idempotency key for the fork."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The forked plan — private, owned by the caller, carrying forkedFromTopic."

      field :nodes, [ Types::KnowledgeNodeType ],
            null: false,
            description: "The forked plan's nodes, in order — structure copied verbatim."

      def resolve(source_plan_id:, client_uuid:)
        command_result(::Plans::ForkPlanCommand.call(
          current_user: current_user!,
          source_plan_id: source_plan_id,
          client_uuid: client_uuid
        ))
      end
    end
  end
end
