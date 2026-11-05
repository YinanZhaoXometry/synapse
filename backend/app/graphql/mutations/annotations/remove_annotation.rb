# frozen_string_literal: true

module Mutations
  module Annotations
    # Remove one annotation (FR-16, epic-13 T3) — thin per AD-12: authorize
    # (current_user!) → command → map. The row-only delete (no dependents)
    # and the uniform NOT_FOUND matrix live in
    # ::Annotations::RemoveAnnotationCommand.
    class RemoveAnnotation < BaseMutation
      description "Remove one annotation (FR-16) — the row goes, nothing else (an annotation has no dependents). Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :id, String,
               required: true,
               description: "The annotation's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      field :deleted_annotation_id, String,
            null: false,
            description: "The deleted annotation's uuid — for client cache eviction."

      def resolve(id:)
        command_result(::Annotations::RemoveAnnotationCommand.call(current_user: current_user!, id: id))
      end
    end
  end
end
