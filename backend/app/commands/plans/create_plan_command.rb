# frozen_string_literal: true

module Plans
  # Create a study plan with its knowledge nodes (AD-3) — the Phase-1
  # plan-repository createPlan mirror: {topic, goal, nodes:[{title, stage}]}
  # with the client-supplied plan uuid as the idempotency key (AD-12;
  # kickoff delta 3). epic-16 T1: nodes may carry a client-supplied id (the
  # address the edge pairs reference) + roadmap metadata
  # {description, optional}, and `edges` carries id-paired prerequisites —
  # resolved to node positions here, validated (membership / stage-forward /
  # dedupe) in Plans::PlanCreation, drops silent-but-logged. The creation
  # core (validation, idempotency, the one transaction) is shared with
  # ConfirmProposalCommand via Plans::PlanCreation.
  class CreatePlanCommand < ApplicationCommand
    include PlanCreation

    option :current_user
    option :client_uuid
    option :topic
    option :goal, optional: true
    option :visibility, optional: true
    option :nodes
    option :edges, optional: true

    def call
      create_plan_with_nodes(
        current_user: current_user,
        client_uuid: client_uuid,
        topic: topic,
        goal: goal,
        visibility: visibility,
        nodes_attrs: nodes,
        edge_pairs: edge_pairs
      )
    end

    private

    # The client's id pairs → [from, to] positions over the nodes input. An
    # endpoint id that names no input node resolves nowhere (nil) — the core
    # drops the pair via the membership rule.
    def edge_pairs
      positions = nodes.each_with_index.with_object({}) do |(attrs, index), map|
        map[attrs[:id].to_s] = index if attrs[:id].present?
      end
      Array(edges).map do |edge|
        [ positions[edge[:from_node_id].to_s], positions[edge[:to_node_id].to_s] ]
      end
    end
  end
end
