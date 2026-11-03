# frozen_string_literal: true

module Plans
  # Create a study plan with its knowledge nodes (AD-3) — the Phase-1
  # plan-repository createPlan mirror: {topic, goal, nodes:[{title, stage}]}
  # with the client-supplied plan uuid as the idempotency key (AD-12;
  # kickoff delta 3). The creation core (validation, idempotency, the one
  # transaction) is shared with ConfirmProposalCommand via Plans::PlanCreation.
  class CreatePlanCommand < ApplicationCommand
    include PlanCreation

    option :current_user
    option :client_uuid
    option :topic
    option :goal, optional: true
    option :visibility, optional: true
    option :nodes

    def call
      create_plan_with_nodes(
        current_user: current_user,
        client_uuid: client_uuid,
        topic: topic,
        goal: goal,
        visibility: visibility,
        nodes_attrs: nodes
      )
    end
  end
end
