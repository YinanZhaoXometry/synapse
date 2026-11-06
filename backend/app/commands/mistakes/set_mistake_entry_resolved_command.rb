# frozen_string_literal: true

module Mistakes
  # The mistake-lifecycle setter (epic-18 T1, spec decision 4): the owner
  # marks a mistake resolved (and open again). User-marked, single boolean —
  # no auto-resolve by later correct answers (a correct answer elsewhere is
  # not a review), forfeited entries resolve like any other (a forfeit is
  # still a mistake worth reviewing). The flag is lifecycle + display only:
  # nothing here touches evidence_records or Mastery (AD-6/ADR-0001 fence),
  # and the targeting mistake bonus keeps riding any entry (spec decision 5,
  # annotated at Ai::TargetingCandidates — open-only consciously deferred to
  # epic-21).
  #
  # Replay-before-write (AD-12): the client uuid is the operation's
  # idempotency key, but a setter stamps no row of its own — so the row's
  # current state IS the replay answer: the entry already carrying the
  # requested state returns UNCHANGED (updated_at untouched — no phantom
  # activity on a double-tap or an offline replay). Addressing follows the
  # house NOT_FOUND matrix (AD-13): unknown, foreign, and malformed entry ids
  # answer uniformly NOT_FOUND (a malformed address must not degrade into an
  # INTERNAL from the uuid column comparison); a non-uuid clientUuid is the
  # delta-3 shape refusal (VALIDATION_FAILED).
  class SetMistakeEntryResolvedCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :id
    option :resolved

    def call
      unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
      end

      unless [ true, false ].include?(resolved)
        return Failure(:VALIDATION_FAILED, { message: "resolved must be a boolean", field: :resolved })
      end

      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "mistake entry not found" })
      end

      entry = current_user.mistake_entries.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "mistake entry not found" }) unless entry

      return Success(mistake_entry: entry) if entry.resolved == resolved

      entry.update!(resolved: resolved)
      Success(mistake_entry: entry)
    end
  end
end
