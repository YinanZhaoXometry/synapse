# frozen_string_literal: true

module Annotations
  # Remove one annotation (FR-16, epic-13 T3): the row goes, nothing else
  # (an annotation has no dependents). Addressing follows the house
  # NOT_FOUND matrix (AD-13): the row loads through the OWNER's annotations
  # scope, so unknown, foreign, and malformed ids answer uniformly
  # NOT_FOUND — never a bare find, never another user's row.
  class RemoveAnnotationCommand < ApplicationCommand
    option :current_user
    option :id

    def call
      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "annotation not found" })
      end

      annotation = current_user.annotations.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "annotation not found" }) unless annotation

      annotation.delete
      Success(deleted_annotation_id: annotation.id)
    end
  end
end
