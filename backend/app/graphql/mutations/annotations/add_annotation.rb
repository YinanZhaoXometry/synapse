# frozen_string_literal: true

module Mutations
  module Annotations
    # Add one annotation (FR-16, epic-13 T3) — thin per AD-12: parse →
    # authorize (current_user!) → command → map. Every rule (the delta-3
    # range shape law, the kind/color vocabularies, the body cap, the
    # NOT_FOUND material addressing) lives in ::Annotations::AddAnnotationCommand;
    # failure mapping lives in Mutations::BaseMutation#command_result.
    class AddAnnotation < BaseMutation
      description "Add one annotation (FR-16): a highlight or underline pinned by char offsets. The range must carry exactly the address the locator's kind names (markdown → sectionId, pdf → page, xor, agreeing — VALIDATION_FAILED otherwise); quote is the drift-verification span; color is a named palette key or null; body is the free-text note (empty for pure highlights). Cross-user material ids are NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The annotated material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :locator, Types::ReadingLocatorInput,
               required: true,
               description: "Where the annotation sits: {kind:\"pdf\", page} or {kind:\"markdown\", sectionId} (AD-2)."

      argument :range, Types::AnnotationRangeInput,
               required: true,
               description: "The char offsets + quoted span within the anchor text (AD-2, delta 3)."

      argument :kind, String,
               required: false,
               description: "\"highlight\" (default) | \"underline\"."

      argument :color, String,
               required: false,
               description: "A named palette key (coral | amber | emerald | blue); omitted/null rides the reader's default."

      argument :body, String,
               required: false,
               description: "The free-text note (at most 2,000 characters — VALIDATION_FAILED beyond). Empty for pure highlights."

      field :annotation, Types::AnnotationType,
            null: false,
            description: "The fresh annotation row."

      def resolve(material_id:, locator:, range:, kind: nil, color: nil, body: nil)
        command_result(::Annotations::AddAnnotationCommand.call(
          current_user: current_user!,
          material_id: material_id,
          locator: locator.to_h,
          range: range.to_h,
          kind: kind || "highlight",
          color: color,
          body: body
        ))
      end
    end
  end
end
