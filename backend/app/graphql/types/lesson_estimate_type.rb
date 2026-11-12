# frozen_string_literal: true

module Types
  # The generated-lesson call estimate (epic-36 T1, spec decision 10): the
  # expected provider-call band derived from Ai::Lessons' template constants
  # — never a hand-written cost table. The entry pages (a template-shaped
  # range) and the outline confirm page (an exact count from the confirmed
  # outline size) share this ONE source, and the proposeLessonOutline payload
  # carries the same math.
  class LessonEstimateType < Types::BaseObject
    description "The expected provider-call band for one generated lesson (epic-36 — derived from the template constants, shared by the entry and confirm surfaces)."

    field :outline_calls, Int,
          null: false,
          description: "The outline's call cost (1 for both shapes — ② generated internally at create, ① the propose gate)."

    field :sections_min, Int,
          null: false,
          description: "The least expected section fills (the node template's 4; the material variant's 1-to-max band, or the confirmed outline size)."

    field :sections_max, Int,
          null: false,
          description: "The most expected section fills (the node template's 6; the material cap 8, or the confirmed outline size)."

    field :total_min, Int,
          null: false,
          description: "outlineCalls + sectionsMin."

    field :total_max, Int,
          null: false,
          description: "outlineCalls + sectionsMax."
  end
end
