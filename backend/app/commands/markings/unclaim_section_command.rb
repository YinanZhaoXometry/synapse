# frozen_string_literal: true

module Markings
  # Unmark a claimed section — clearing an open claim sets cleared_at and
  # preserves the row (the ER's history law: nothing is deleted, nothing is
  # unique). The op addresses THE OPEN CLAIM for (user, material, section):
  # no open claim — never claimed, or already cleared — is a NOT_FOUND, the
  # uniform unknown-address answer (delta 2). claimed_at stands; only the
  # cleared_at moves.
  #
  # A claim being a claim (FR-15), the clearing touches no other row and
  # never the evidence_records table — asserted by spec at both layers.
  class UnclaimSectionCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :section_id

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a
      # foreign id gets (a malformed address must not degrade into an
      # INTERNAL 500).
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      if section_id.to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "section id is required", field: :sectionId })
      end

      open = current_user.section_markings.find_by(material_id: material.id, section_id: section_id,
                                                   cleared_at: nil)
      return open_claim_not_found unless open

      open.update!(cleared_at: Time.current)
      Success(section_marking: open)
    end

    private

    def open_claim_not_found
      Failure(:NOT_FOUND, { message: "no open section marking to clear" })
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
