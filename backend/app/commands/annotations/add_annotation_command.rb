# frozen_string_literal: true

module Annotations
  # Add one annotation (FR-16, epic-13 T3): a highlight or underline pinned
  # by char offsets — the AD-2 locator ({kind:"pdf",page} |
  # {kind:"markdown",sectionId}) plus the AD-2 range jsonb
  # ({sectionId?|page?, start, end, quote}: offsets within the anchor text
  # + the quoted span for drift verification), stored with TS keys verbatim
  # (delta 2/3; jsonb as-is). Shape checks live HERE (the delta-3 law):
  #   - locator: the ReadingLocators matrix (pdf needs page ≥ 1, markdown
  #     a non-blank sectionId) → VALIDATION_FAILED;
  #   - range: int offsets ≥ 0 with end ≥ start, a non-blank quote, and
  #     sectionId XOR page — carrying the one the locator's kind names and
  #     AGREEING with it (a divergent duplicate address is refused, never
  #     stored) → VALIDATION_FAILED;
  #   - kind ∈ highlight|underline (default highlight), color nil or a
  #     named palette key → VALIDATION_FAILED outside;
  #   - body: the free-text note, capped at MAX_NOTE_CHARS (v2-empty).
  # The material is addressed through the owner's association path (delta
  # 2 — unknown/foreign/malformed → uniform NOT_FOUND). Deliberately NOT
  # idempotent: no client uuid on the op (see Annotations module comment).
  class AddAnnotationCommand < ApplicationCommand
    include ReadingLocators

    option :current_user
    option :material_id
    option :locator
    option :range
    option :kind, default: -> { "highlight" }
    option :color
    option :body

    def call
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      failure = validate_kind!
      return failure if failure
      failure = validate_color!
      return failure if failure
      failure = validate_locator!(locator, field: :locator)
      return failure if failure
      failure = validate_range_shape!
      return failure if failure
      failure = validate_body!
      return failure if failure

      annotation = current_user.annotations.create!(
        material: material,
        locator: locator_as_jsonb(locator),
        range: range_as_jsonb,
        kind: kind,
        color: color.presence,
        body: body.to_s
      )
      Success(annotation: annotation)
    end

    private

    def validate_kind!
      return nil if Annotation.kinds.key?(kind.to_s)

      Failure(:VALIDATION_FAILED, { message: "kind is invalid (highlight | underline)", field: :kind })
    end

    def validate_color!
      return nil if color.blank?
      return nil if Annotations::NAMED_COLORS.include?(color.to_s)

      Failure(:VALIDATION_FAILED, { message: "color is not a named palette key", field: :color })
    end

    # The delta-3 range matrix: offsets + quote, then the sectionId-xor-page
    # address agreeing with the locator kind.
    def validate_range_shape!
      return shape_failure("range must be a range shape") unless range.is_a?(Hash)

      start_offset = range[:start]
      end_offset = range[:end]
      unless start_offset.is_a?(Integer) && start_offset >= 0 && end_offset.is_a?(Integer) && end_offset >= 0 &&
             end_offset >= start_offset
        return shape_failure("range offsets must be integers ≥ 0 with end ≥ start")
      end
      return shape_failure("range quote is required") if range[:quote].to_s.strip.empty?
      return shape_failure(range_address_message) unless range_address_valid?

      nil
    end

    # sectionId XOR page, carrying exactly the address the locator's kind
    # names and agreeing with it (a divergent duplicate address is refused,
    # never stored).
    def range_address_valid?
      if locator[:kind] == "pdf"
        range.key?(:page) && !range.key?(:section_id) && range[:page] == locator[:page]
      else
        range.key?(:section_id) && !range.key?(:page) && range[:section_id].to_s == locator[:section_id].to_s
      end
    end

    def range_address_message
      if locator[:kind] == "pdf"
        "a pdf annotation's range names its page (xor sectionId), agreeing with the locator"
      else
        "a markdown annotation's range names its sectionId (xor page), agreeing with the locator"
      end
    end

    def shape_failure(message)
      Failure(:VALIDATION_FAILED, { message: message, field: :range })
    end

    def validate_body!
      return nil if body.to_s.length <= Annotations::MAX_NOTE_CHARS

      Failure(:VALIDATION_FAILED,
              { message: "body exceeds the #{Annotations::MAX_NOTE_CHARS}-character cap", field: :body })
    end

    # The jsonb row: string-keyed, TS keys verbatim (delta 3) — the reader
    # and the wire read exactly these.
    def range_as_jsonb
      address = if locator[:kind] == "pdf"
                  { "page" => range[:page] }
      else
                  { "sectionId" => range[:section_id] }
      end
      address.merge("start" => range[:start], "end" => range[:end], "quote" => range[:quote])
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
