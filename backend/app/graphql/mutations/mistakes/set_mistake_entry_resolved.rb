# frozen_string_literal: true

module Mutations
  module Mistakes
    # The mistake-lifecycle toggle (epic-18 T1, spec decision 4) — thin per
    # AD-12: authorize (current_user!) → command → map. The replay-before-
    # write law (the carried state returns unchanged, updated_at untouched),
    # the client-uuid shape refusal, and the uniform NOT_FOUND matrix live in
    # ::Mistakes::SetMistakeEntryResolvedCommand.
    class SetMistakeEntryResolved < BaseMutation
      description "Mark a mistake entry resolved (or open again) — the owner's review toggle (epic-18, spec decision 4). Replay-safe: an entry already carrying the requested state returns unchanged (updated_at untouched). Unknown, foreign, or malformed entry ids are NOT_FOUND; a non-uuid clientUuid is VALIDATION_FAILED."

      argument :client_uuid, String,
               required: true,
               description: "The client's idempotency key for this toggle (AD-12)."

      argument :id, String,
               required: true,
               description: "The mistake entry's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :resolved, Boolean,
               required: true,
               description: "The lifecycle state to set (true = resolved/reviewed, false = open again)."

      field :mistake_entry, Types::MistakeEntryType,
            null: false,
            description: "The toggled mistake entry (itself on a same-state toggle)."

      def resolve(client_uuid:, id:, resolved:)
        command_result(::Mistakes::SetMistakeEntryResolvedCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          id: id,
          resolved: resolved
        ))
      end
    end
  end
end
