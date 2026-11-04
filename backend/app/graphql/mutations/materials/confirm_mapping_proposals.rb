# frozen_string_literal: true

module Mutations
  module Materials
    # confirmMappingProposals (FR-45, epic P2-10 T1; delta decisions 3+4):
    # bulk-confirm proposed mapping rows — thin per AD-12. The command owns
    # the grouping rule: rows sharing a proposed_node_title become ONE real
    # plan-scoped KnowledgeNode (title-deduped, order = max+1) and flip to
    # confirmed with that node; rows already decided return unchanged;
    # unknown/foreign ids are uniformly NOT_FOUND.
    class ConfirmMappingProposals < BaseMutation
      description "Confirm proposed mapping rows (FR-45, epic P2-10 T1): rows sharing a proposedNodeTitle become ONE real plan-scoped knowledge node (reusing the plan's same-title node when one exists; order = max+1) and flip to confirmed with that node's id; rows already pointed at a node just flip. Already-confirmed/rejected rows return unchanged. Unknown or foreign ids are NOT_FOUND and change nothing."

      argument :mapping_ids, [ String ],
               required: true,
               description: "The mapping rows' uuids to confirm (a proposed-node group's rows travel together)."

      field :mappings, [ Types::MaterialNodeMappingType ],
            null: false,
            description: "The mapping rows after the confirmation (unchanged rows included)."

      def resolve(mapping_ids:)
        command_result(::Materials::ConfirmMappingProposalsCommand.call(
          current_user: current_user!,
          mapping_ids: mapping_ids
        ))
      end
    end
  end
end
