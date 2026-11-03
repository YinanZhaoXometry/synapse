# frozen_string_literal: true

module Mutations
  module Markings
    # Unmark a claimed section — thin per AD-12: parse → authorize
    # (current_user!) → command → map. Every rule (clearing sets cleared_at
    # and preserves the row, the no-open-claim NOT_FOUND, the NOT_FOUND
    # material addressing) lives in ::Markings::UnclaimSectionCommand;
    # failure mapping lives in Mutations::BaseMutation#command_result via
    # the epic-01 ErrorPresenter.
    class UnclaimSection < BaseMutation
      description "Unmark a claimed section — clearing sets clearedAt and preserves the row (history, nothing deleted). Answers NOT_FOUND when there is no open claim to clear (never claimed, or already cleared). Cross-user material ids are NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The marked material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :section_id, String,
               required: true,
               description: "The marked section's stable id. Blank ids are refused."

      field :section_marking, Types::SectionMarkingType,
            null: false,
            description: "The cleared claim (claimedAt stands, clearedAt set)."

      def resolve(material_id:, section_id:)
        command_result(::Markings::UnclaimSectionCommand.call(
          current_user: current_user!,
          material_id: material_id,
          section_id: section_id
        ))
      end
    end
  end
end
