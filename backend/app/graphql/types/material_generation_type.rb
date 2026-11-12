# frozen_string_literal: true

module Types
  # A generated lesson's live generation state (epic-36 T1, spec decision 2):
  # the materials.generation jsonb, verbatim. The reader's pending/streaming/
  # paused surfaces are driven ENTIRELY by this — parse_state is NOT it (that
  # stays the client file-parse axis; a lesson is always parsed). Only
  # origin=generated rows carry a value.
  class MaterialGenerationType < Types::BaseObject
    description "A generated lesson's live generation state (epic-36 — the reader's pending/streaming/paused surfaces read this, never parseState). Present only on origin=generated materials."

    field :variant, String,
          null: false,
          description: "The entry shape that created the lesson: \"node\" (② — a plan node's confirmed mapped sections) or \"material\" (① — one whole uploaded material)."

    field :source_material_ids, [ String ],
          null: false,
          description: "The origin=uploaded materials the lesson was generated from — never another lesson (the 源池排他 law)."

    field :outline, [ Types::LessonOutlineChapterType ],
          null: false,
          description: "The outline placeholders, in chapter order — each flips to `ready` the moment its section lands (the stream op's per-section atomicity)."

    field :paused_kind, String,
          null: true,
          description: "Why generation is paused, if it is: \"cap\" (the daily budget tripped mid-lesson) or \"provider\" (the provider kept failing). Cleared by the next explicit resume (a fresh stream ticket)."

    field :generated_at, Types::DateTime,
          null: false,
          description: "When the lesson row was created (the generation's start)."

    def variant
      object["variant"]
    end

    def source_material_ids
      object["sourceMaterialIds"]
    end

    def outline
      Array(object["outline"])
    end

    def paused_kind
      object["pausedKind"]
    end

    def generated_at
      Time.zone.parse(object["generatedAt"].to_s)
    end
  end
end
