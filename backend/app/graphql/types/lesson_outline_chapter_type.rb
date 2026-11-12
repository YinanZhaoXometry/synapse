# frozen_string_literal: true

module Types
  # One chapter of a generated lesson's outline (epic-36 T1, spec decision
  # 2). The type serves THREE riders with different field availability:
  #   proposeLessonOutline — title + sourceSectionIds only (stateless, no
  #     ids/anchors yet — the echoed outline re-derives them server-side);
  #   Material.generation.outline — id + title + anchors + status (the
  #     persisted placeholders the reader's live generation state reads);
  #   createLesson's echoed input is the INPUT twin (LessonOutlineChapterInput).
  class LessonOutlineChapterType < Types::BaseObject
    description "One chapter of a generated lesson's outline (epic-36). proposeLessonOutline returns title+sourceSectionIds only; a persisted outline carries id+anchors+status."

    field :id, String,
          null: true,
          description: "The chapter's stable id on the persisted outline (ch-N, server-minted) — the lesson section id the stream op addresses. Null on a proposeLessonOutline reply (nothing persisted yet)."

    field :title, String,
          null: false,
          description: "The chapter's title."

    field :anchors, [ Types::SourceAnchorType ],
          null: true,
          description: "The source sections the chapter was generated from (server-owned). Null on a proposeLessonOutline reply."

    field :status, String,
          null: true,
          description: "The chapter's generation status on the persisted outline: pending | generating | ready | failed. Null on a proposeLessonOutline reply."

    field :source_section_ids, [ String ],
          null: true,
          description: "The source section ids the chapter teaches — proposeLessonOutline's vocabulary (the echoed outline carries these back to createLesson). Null on a persisted outline."

    def id
      object["id"]
    end

    def title
      object["title"]
    end

    def anchors
      object["anchors"]
    end

    def status
      object["status"]
    end

    def source_section_ids
      object["sourceSectionIds"]
    end
  end
end
