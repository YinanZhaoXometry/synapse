# frozen_string_literal: true

module Materials
  # Shared section-payload validation + storage shape for the two
  # material-writing commands (AttachMaterialCommand and
  # SetMaterialParseResultCommand). Mixed in as instance methods so both
  # commands run one code path — and can use the ApplicationCommand Failure
  # factory directly.
  #
  # - A section id is required: quiz sourcing and section markings address
  #   sections by it (FR-18/NFR-1 provenance), so a blank id would sever the
  #   provenance chain.
  # - Per-section text is capped at Materials::MAX_SECTION_CHARS →
  #   VALIDATION_FAILED beyond (kickoff delta 6). No truncation server-side.
  module SectionValidation
    # Returns the first typed Failure, or nil when the payload is clean.
    def validate_sections!(sections)
      sections.each do |section|
        if section[:id].to_s.strip.empty?
          return Failure(:VALIDATION_FAILED, { message: "section id is required", field: :sections })
        end
        next unless section[:text].to_s.length > Materials::MAX_SECTION_CHARS

        return Failure(:VALIDATION_FAILED,
                       { message: "section text exceeds the #{Materials::MAX_SECTION_CHARS}-character cap",
                         field: :sections })
      end
      nil
    end

    private

    # The jsonb row shape the factories pin: string-keyed { id, title, text }
    # (frontend/src/domain/entities.ts MaterialSection keys, verbatim).
    def sections_as_jsonb(sections)
      sections.map { |section| { "id" => section[:id], "title" => section[:title], "text" => section[:text] } }
    end
  end
end
