# frozen_string_literal: true

module Mutations
  # The first-login import (epic P2-8 ticket 03; AD-15) — thin per AD-12:
  # parse → authorize (current_user!) → command → map. Every rule (the
  # whole-document shape, the delta-3 idempotency triad generalized to a
  # document, the foreign-uuid refusal, the linkage integrity, the delta-6
  # bounds) lives in ::Import::ImportDocumentCommand; failure mapping lives
  # in Mutations::BaseMutation#command_result via the epic-01
  # ErrorPresenter. Materials arrive byteless — the re-attach invite (the
  # epic-06 presign flow) restores them, matched by id.
  class ImportDocument < BaseMutation
    description "Carry a whole Phase-1 local document to the api in one idempotent mutation — the first-login import (AD-15). Every row is keyed by its client uuid (AD-12): a same-user replay skips owned rows (a mixed replay merges — retry safe); a uuid owned by ANOTHER user fails VALIDATION_FAILED and nothing is written (whole-document atomicity, FR-4). Materials arrive WITHOUT bytes — the re-attach invite restores them afterward."

    argument :document, Types::DocumentInput,
             required: true,
             description: "The whole Phase-1 document — the collections verbatim from the localStorage snapshot."

    field :imported, Int,
          null: false,
          description: "How many rows this call created (0 on a pure replay)."

    field :skipped, Int,
          null: false,
          description: "How many rows were already owned and left untouched."

    def resolve(document:)
      command_result(::Import::ImportDocumentCommand.call(
        current_user: current_user!,
        document: document.to_h
      ))
    end
  end
end
