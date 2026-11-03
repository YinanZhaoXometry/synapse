# frozen_string_literal: true

module Mutations
  module Markings
    # Claim a material section as mastered (FR-15) — thin per AD-12: parse →
    # authorize (current_user!) → command → map. Every rule (the open-claim
    # idempotency, the history law, the blank-section refusal, the NOT_FOUND
    # material addressing) lives in ::Markings::ClaimSectionCommand; failure
    # mapping lives in Mutations::BaseMutation#command_result via the
    # epic-01 ErrorPresenter.
    class ClaimSection < BaseMutation
      description "Claim a material section as mastered (FR-15). A claim is a claim, NEVER evidence — it can never move a Mastery Score. Re-claiming while the claim is open returns it unchanged (no duplicate); claim → unclaim → re-claim preserves history as new rows. Cross-user material ids are NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The marked material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :section_id, String,
               required: true,
               description: "The marked section's stable id (a MaterialSection id string — a slug, not a uuid). Blank ids are refused."

      field :section_marking, Types::SectionMarkingType,
            null: false,
            description: "The claim (the existing open one on a re-claim, a fresh row otherwise)."

      def resolve(material_id:, section_id:)
        command_result(::Markings::ClaimSectionCommand.call(
          current_user: current_user!,
          material_id: material_id,
          section_id: section_id
        ))
      end
    end
  end
end
