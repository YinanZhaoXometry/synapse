# frozen_string_literal: true

module Plans
  # Confirm a creation-chat plan proposal into a plan + nodes in ONE
  # transaction (ticket AC). The payload arrives from epic-05's stream at
  # runtime; here it is just an input, mirroring the Phase-1
  # PlanStructureProposal (frontend/src/ai/types.ts): stage-grouped node
  # titles. The flattening mirrors toPlanCreateInput
  # (frontend/src/features/plans/creation-mapping.ts) exactly — stage-then-
  # title, one global order index — minus the rename map (renames are a UI
  # concern applied before confirm). Idempotent on the client uuid via the
  # shared Plans::PlanCreation core (kickoff delta 3).
  class ConfirmProposalCommand < ApplicationCommand
    include PlanCreation

    option :current_user
    option :client_uuid
    option :topic
    option :goal, optional: true
    option :visibility, optional: true
    option :stages

    def call
      nodes_attrs = flattened_nodes
      if nodes_attrs.empty?
        return Failure(:VALIDATION_FAILED,
                       { message: "a proposal needs at least one node title", field: :stages })
      end
      if stages.any? { |stage| stage[:name].to_s.strip.empty? }
        return Failure(:VALIDATION_FAILED, { message: "stage name is required", field: :stages })
      end

      create_plan_with_nodes(
        current_user: current_user,
        client_uuid: client_uuid,
        topic: topic,
        goal: goal,
        visibility: visibility,
        nodes_attrs: nodes_attrs
      )
    end

    private

    # Stage-then-title flatten, one global order index — the same
    # enumeration order toPlanCreateInput uses, so a confirmed proposal
    # produces the identical node sequence client- and server-side.
    def flattened_nodes
      stages.flat_map do |stage|
        stage[:node_titles].map { |title| { title: title, stage: stage[:name] } }
      end
    end
  end
end
