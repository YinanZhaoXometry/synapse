# frozen_string_literal: true

module Materials
  # Write the reader's parse outcome back — the Phase-1 material-repository
  # setMaterialParseResult mirror (frontend/src/data/material-repository.ts):
  # sections (bounded per-section) + the final parsed|failed state. A failure
  # keeps the material's metadata and stores the reason (defaulting to
  # "unknown" when none was extracted); a success clears any previous
  # failure. This is the only post-attach state transition the repo models —
  # "pending"/"parsing" are attach-time states (the client attaches with the
  # state it is in; the eager-parse-at-attach flow never needs a separate
  # markMaterialParsing step server-side).
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the material
  # is addressed through the owner's association path, so an unknown or
  # foreign id is uniformly NOT_FOUND (delta 2) where Phase-1 no-ops unknown
  # ids; and the command returns the updated row (the Phase-1 write is void)
  # so the mutation's payload can hand the client the fresh state.
  class SetMaterialParseResultCommand < ApplicationCommand
    include SectionValidation

    option :current_user
    option :id
    option :sections
    option :state
    option :reason, optional: true

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500).
      return material_not_found unless id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: id)
      return material_not_found unless material

      unless Materials::PARSE_RESULT_STATES.include?(state.to_s)
        return Failure(:VALIDATION_FAILED, { message: "state must be parsed or failed", field: :state })
      end

      validation = validate_sections!(sections)
      return validation if validation

      # Phase-1's write-back: a failure stores the reason (defaulting to
      # "unknown"); a success clears any previous failure.
      final_reason = nil
      if state.to_s == "failed"
        if reason && !Material.parse_failure_reasons.key?(reason.to_s)
          return Failure(:VALIDATION_FAILED, { message: "parse failure reason is invalid", field: :reason })
        end
        final_reason = reason || "unknown"
      end

      material.update!(
        parse_state: state.to_s,
        sections: sections_as_jsonb(sections),
        parse_failure_reason: final_reason
      )
      Success(material: material)
    end

    private

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
