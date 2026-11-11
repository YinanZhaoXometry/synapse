# frozen_string_literal: true

module Types
  module Ai
    # One echoed chapter of the createLesson ① input (epic-36 T1, spec
    # decision 5): the proposeLessonOutline output carried back through the
    # confirm mutation — title + the source section ids. Server-minted ids /
    # anchors / statuses deliberately DO NOT ride (the server re-derives and
    # re-validates everything; the wire carries nothing it doesn't have to
    # trust).
    class LessonOutlineChapterInput < Types::BaseInputObject
      argument :title, String,
               required: true,
               description: "The chapter's title, exactly as the propose gate returned it (uniqueness is re-validated server-side)."

      argument :source_section_ids, [ String ],
               required: true,
               description: "The source section ids the chapter teaches — every id must exist on the source material."
    end
  end
end
