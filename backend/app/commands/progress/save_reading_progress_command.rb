# frozen_string_literal: true

module Progress
  # Save where the reader stopped — the Phase-1 progress-repository
  # saveReadingProgress mirror (frontend/src/data/progress-repository.ts):
  # an upsert keyed by the material (1:1, unique index — the re-save IS the
  # idempotency), carrying the domain ReadingPosition verbatim (AD-2 /
  # kickoff delta 7): the locator {kind:"pdf",page} | {kind:"markdown",
  # sectionId} + the extracted text, jsonb with TS keys exactly.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the material
  # is addressed through the owner's association path (delta 2 — unknown/
  # foreign/malformed → NOT_FOUND, where Phase-1 trusted the client's ids);
  # the locator shape is validated server-side (Phase-1 persisted whatever
  # arrived); and the position text is capped at the delta-6 bound
  # (Materials::MAX_SECTION_CHARS — the same per-section extracted-text
  # class) → VALIDATION_FAILED beyond, where Phase-1 truncated client-side.
  class SaveReadingProgressCommand < ApplicationCommand
    include ReadingLocators

    option :current_user
    option :material_id
    option :position

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a
      # foreign id gets (a malformed address must not degrade into an
      # INTERNAL 500).
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      failure = validate_locator!(position[:locator], field: :position)
      return failure if failure
      if position[:text].to_s.length > Materials::MAX_SECTION_CHARS
        return Failure(:VALIDATION_FAILED,
                       { message: "position text exceeds the #{Materials::MAX_SECTION_CHARS}-character cap",
                         field: :position })
      end

      row = current_user.reading_progresses.find_by(material_id: material.id)
      if row
        row.update!(position: position_as_jsonb)
      else
        begin
          # Same shape as the chat command's backstop (kept consistent): the
          # create attempt runs in a SAVEPOINT (requires_new — the Rails
          # create_or_find_by pattern), so the unique-material_id race's
          # failed INSERT cannot abort an enclosing Postgres transaction and
          # turn the winner's-row read-back below into
          # PG::InFailedSqlTransaction → INTERNAL.
          ActiveRecord::Base.transaction(requires_new: true) do
            row = current_user.reading_progresses.create!(material: material, position: position_as_jsonb)
          end
        rescue ActiveRecord::RecordNotUnique
          # The unique-material_id race between the pre-check and the INSERT
          # (the delta-3 backstop shape): the winner's row exists now — read
          # it back and upsert over it. Safe because the savepoint rolled
          # back only the failed INSERT.
          row = current_user.reading_progresses.find_by!(material_id: material.id)
          row.update!(position: position_as_jsonb)
        end
      end
      Success(reading_progress: row)
    end

    private

    # The jsonb row the factories pin: string-keyed, TS keys verbatim.
    def position_as_jsonb
      { "locator" => locator_as_jsonb(position[:locator]), "text" => position[:text].to_s }
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
