# frozen_string_literal: true

module Mutations
  module Materials
    # rejectMappingProposals (FR-45, epic P2-10 T1; delta decisions 3+4):
    # bulk-reject proposed mapping rows — thin per AD-12. The rejection is
    # durable: the map command skips rejected sections forever (never
    # re-proposed). Rows already decided return unchanged; unknown/foreign
    # ids are uniformly NOT_FOUND.
    class RejectMappingProposals < BaseMutation
      description "Reject proposed mapping rows (FR-45, epic P2-10 T1): the rows persist with status rejected and the mapping run never re-proposes their sections. Already-confirmed/rejected rows return unchanged. Unknown or foreign ids are NOT_FOUND and change nothing."

      argument :mapping_ids, [ String ],
               required: true,
               description: "The mapping rows' uuids to reject (a proposed-node group's rows travel together)."

      field :mappings, [ Types::MaterialNodeMappingType ],
            null: false,
            description: "The mapping rows after the rejection (unchanged rows included)."

      def resolve(mapping_ids:)
        command_result(::Materials::RejectMappingProposalsCommand.call(
          current_user: current_user!,
          mapping_ids: mapping_ids
        ))
      end
    end
  end
end
