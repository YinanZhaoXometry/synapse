# frozen_string_literal: true

module Mutations
  module Progress
    # Save where the reader stopped — thin per AD-12: parse → authorize
    # (current_user!) → command → map. Every rule (the by-material upsert
    # that IS the idempotency, the verbatim locator+text jsonb, the delta-6
    # text cap, the NOT_FOUND material addressing) lives in
    # ::Progress::SaveReadingProgressCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class SaveReadingProgress < BaseMutation
      description "Save where the reader stopped — an upsert keyed by the material (1:1; the re-save overwrites cleanly and is the op's idempotency). The ReadingPosition (locator + text) is stored verbatim with TS keys (AD-2 / kickoff delta 7). Cross-user material ids are NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The read material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :position, Types::ReadingPositionInput,
               required: true,
               description: "The ReadingPosition: locator + extracted text."

      field :reading_progress, Types::ReadingProgressType,
            null: false,
            description: "The stored (created or overwritten) progress row."

      def resolve(material_id:, position:)
        command_result(::Progress::SaveReadingProgressCommand.call(
          current_user: current_user!,
          material_id: material_id,
          position: position.to_h
        ))
      end
    end
  end
end
