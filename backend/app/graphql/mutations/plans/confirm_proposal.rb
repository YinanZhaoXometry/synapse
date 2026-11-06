# frozen_string_literal: true

module Mutations
  module Plans
    # Confirm a creation-chat plan proposal into a plan + nodes in ONE
    # transaction (ticket AC) — thin per AD-12: parse → authorize
    # (current_user!) → command → map. The payload mirrors the Phase-1
    # PlanStructureProposal (frontend/src/ai/types.ts): stage-grouped node
    # titles; the flattening (stage-then-title, one global order index) is
    # ::Plans::ConfirmProposalCommand's job, mirroring toPlanCreateInput.
    class ConfirmProposal < BaseMutation
      description "Confirm a creation-chat plan proposal (epic-05's stream produces it at runtime) into a plan + nodes in one transaction. Idempotent on clientUuid."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied plan uuid (AD-12) — the idempotency key for the confirm."

      argument :topic, String,
               required: true,
               description: "What the plan studies (the proposal's topic)."

      argument :goal, String,
               required: false,
               description: "The optional study goal (added at confirm time, Phase-1 flow)."

      argument :visibility, String,
               required: false,
               description: "\"private\" (default) or \"public\" (FR-38)."

      argument :stages, [ Types::ProposedStageInput ],
               required: true,
               description: "The proposal's stages with their nodes (epic-16) or node titles (pre-epic-16), in proposal order."

      # The proposal's title-paired edges (epic-16): resolved against the
      # confirmed nodes' titles server-side. Invalid pairs drop silently —
      # they never block the confirm.
      argument :edges, [ Types::ProposedEdgeInput ],
               required: false,
               description: "The proposal's edges as [fromTitle, toTitle] pairs (epic-16) — resolved server-side; invalid pairs drop silently."

      field :plan, Types::StudyPlanType,
            null: false,
            description: "The created (or replayed) plan."

      field :nodes, [ Types::KnowledgeNodeType ],
            null: false,
            description: "The confirmed nodes, stage-then-title flattened into one order."

      def resolve(client_uuid:, topic:, stages:, edges: nil, goal: nil, visibility: nil)
        command_result(::Plans::ConfirmProposalCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          topic: topic,
          goal: goal,
          visibility: visibility,
          stages: stages.map(&:to_h),
          edges: (edges || []).map(&:to_h)
        ))
      end
    end
  end
end
