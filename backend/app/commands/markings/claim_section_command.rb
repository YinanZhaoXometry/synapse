# frozen_string_literal: true

module Markings
  # Claim a material section as mastered — the FR-15 Mastery Marking claim.
  # No Phase-1 repository op exists (frontend declares the SectionMarking
  # type "so persistence carries it unchanged" — domain/entities.ts), so the
  # write semantics follow the ER's own law: the claim is a row with a
  # server-set claimed_at and a null cleared_at; an OPEN claim is idempotent
  # (re-claiming returns the existing row, no duplicate); history is
  # preserved — claim → unclaim → re-claim lands a NEW row.
  #
  # Deviations/decisions (recorded in the ticket Comments): the material is
  # addressed through the owner's association path (delta 2 — unknown/
  # foreign/malformed → NOT_FOUND); a blank section id is refused
  # VALIDATION_FAILED (markings address sections by id — FR-18's rule; the
  # section's EXISTENCE inside the material is not validated, the T03
  # Question.sourceSectionId posture).
  class ClaimSectionCommand < ApplicationCommand
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
      return Success(section_marking: open) if open

      marking = current_user.section_markings.create!(material: material, section_id: section_id,
                                                      claimed_at: Time.current)
      Success(section_marking: marking)
    end

    private

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
