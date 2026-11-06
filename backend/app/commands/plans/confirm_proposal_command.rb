# frozen_string_literal: true

module Plans
  # Confirm a creation-chat plan proposal into a plan + nodes in ONE
  # transaction (ticket AC). The payload arrives from epic-05's stream at
  # runtime; here it is just an input, mirroring the Phase-1
  # PlanStructureProposal (frontend/src/ai/types.ts): stage-grouped nodes.
  # epic-16 T1 upgraded the proposal schema — a stage now carries
  # nodes[{title, description, optional}] and top-level title-paired edges;
  # the legacy bare-titles shape stays accepted (pre-epic-16 proposals keep
  # confirming, metadata-less and edgeless). The flattening mirrors
  # toPlanCreateInput (frontend/src/features/plans/creation-mapping.ts)
  # exactly — stage-then-title, one global order index — minus the rename
  # map (renames are a UI concern applied before confirm). Edges resolve
  # titles to node positions server-side (the server's authority mirrors
  # the client's flatten seam); duplicate titles make title-paired edges
  # unresolvable — dropped, deterministic. Validity (membership / stage-
  # forward / dedupe) and the drops live in Plans::PlanCreation. Idempotent
  # on the client uuid via the shared core (kickoff delta 3).
  class ConfirmProposalCommand < ApplicationCommand
    include PlanCreation

    option :current_user
    option :client_uuid
    option :topic
    option :goal, optional: true
    option :visibility, optional: true
    option :stages
    option :edges, optional: true

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
        nodes_attrs: nodes_attrs,
        edge_pairs: edge_pairs(nodes_attrs)
      )
    end

    private

    # Stage-then-title flatten, one global order index — the same
    # enumeration order toPlanCreateInput uses, so a confirmed proposal
    # produces the identical node sequence client- and server-side. A
    # stage's `nodes` (title + metadata) is the epic-16 shape; the legacy
    # `nodeTitles` stays as the fallback.
    def flattened_nodes
      stages.flat_map do |stage|
        proposed_nodes(stage).map do |node|
          {
            title: node[:title],
            stage: stage[:name],
            description: node[:description].to_s.strip.presence,
            optional: node[:optional] == true
          }
        end
      end
    end

    def proposed_nodes(stage)
      stage[:nodes] || (stage[:node_titles] || []).map { |title| { title: title } }
    end

    # The proposal's title pairs → [from, to] positions over the flattened
    # nodes. A title appearing twice maps NOWHERE: duplicate titles make
    # title-paired edges unresolvable — dropped, deterministic (the prompt
    # requests unique titles but nothing trusts them). An unknown title
    # resolves nowhere likewise — both drop via the membership rule.
    def edge_pairs(nodes_attrs)
      positions = {}
      nodes_attrs.each_with_index do |attrs, index|
        title = attrs[:title]
        positions[title] = positions.key?(title) ? nil : index
      end
      Array(edges).map do |edge|
        [positions[edge[:from_title]], positions[edge[:to_title]]]
      end
    end
  end
end
