# frozen_string_literal: true

module Mutations
  module Materials
    # Write the reader's parse outcome back — thin per AD-12: parse →
    # authorize (current_user!) → command → map. The write-back rules (the
    # parsed|failed vocabulary, the delta-6 section cap, the reason default
    # and clear) live in ::Materials::SetMaterialParseResultCommand; failure
    # mapping lives in Mutations::BaseMutation#command_result via the
    # epic-01 ErrorPresenter.
    class SetMaterialParseResult < BaseMutation
      description "Write the reader's parse outcome back (AD-7, the Phase-1 setMaterialParseResult mirror): sections + final parsed|failed state. A failure keeps the metadata and stores the reason (defaulting to \"unknown\"); a success clears any previous failure. Cross-user ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :sections, [ Types::MaterialSectionInput ],
               required: true,
               description: "The parsed sections (replaces any previous ones). May be empty when the parse failed."

      argument :state, String,
               required: true,
               description: "\"parsed\" or \"failed\" — the write-back states (pending/parsing are attach-time states)."

      argument :reason, String,
               required: false,
               description: "corrupt | encrypted | empty | unknown — with a failed state; defaults to \"unknown\"."

      field :material, Types::MaterialType,
            null: false,
            description: "The updated material."

      def resolve(id:, sections:, state:, reason: nil)
        command_result(::Materials::SetMaterialParseResultCommand.call(
          current_user: current_user!,
          id: id,
          sections: sections.map(&:to_h),
          state: state,
          reason: reason
        ))
      end
    end
  end
end
