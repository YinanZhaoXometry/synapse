# frozen_string_literal: true

# Shared ReadingLocator handling for the commands whose payloads carry the
# domain locator (AD-2): Chat citations and the ReadingProgress position.
# Mixed in as instance methods so every command runs one code path — and can
# use the ApplicationCommand Failure factory directly (the
# Materials::SectionValidation pattern).
#
# Kickoff delta 7: locator jsonb carries the TS keys exactly —
# {kind:"pdf", page} | {kind:"markdown", sectionId}, string-keyed rows (the
# ReadingLocatorType readers). The kind-irrelevant keys (a pdf locator's
# sectionId, a markdown locator's page) are normalized away server-side —
# the CreateSessionCommand choice-shape normalization mirror.
module ReadingLocators
  # The locator kind vocabulary (frontend/src/domain/entities.ts ReadingLocator).
  KINDS = %w[pdf markdown].freeze

  # Returns the first typed Failure, or nil when the locator is clean:
  # a pdf locator needs a positive 1-based page, a markdown locator a
  # non-blank section id.
  def validate_locator!(locator, field:)
    kind = locator[:kind].to_s
    unless KINDS.include?(kind)
      return Failure(:VALIDATION_FAILED,
                     { message: "locator kind is invalid (pdf | markdown)", field: field })
    end
    if kind == "pdf"
      page = locator[:page]
      unless page.is_a?(Integer) && page >= 1
        return Failure(:VALIDATION_FAILED,
                       { message: "a pdf locator needs a positive page number", field: field })
      end
    elsif locator[:section_id].to_s.strip.empty?
      return Failure(:VALIDATION_FAILED,
                     { message: "a markdown locator needs a section id", field: field })
    end
    nil
  end

  # The storage row: string-keyed, TS keys verbatim, only the kind-relevant
  # keys carried. Call after validate_locator! — it trusts the clean shape.
  def locator_as_jsonb(locator)
    if locator[:kind] == "pdf"
      { "kind" => "pdf", "page" => locator[:page] }
    else
      { "kind" => "markdown", "sectionId" => locator[:section_id] }
    end
  end
end
