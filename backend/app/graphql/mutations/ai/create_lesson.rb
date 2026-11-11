# frozen_string_literal: true

module Mutations
  module Ai
    # createLesson (epic-36 T1, spec decision 5 — the unified create behind
    # both entries): the generated Material row. ② inputs planId+nodeId (the
    # outline is generated internally — one cap-counted call; an unmapped
    # node refuses with the honest reason; the per-node lesson is a
    # singleton); ① inputs materialId+outline (the echoed propose output,
    # re-validated server-side; NO provider call; the per-source lesson is a
    # singleton). The client uuid keeps its delta-3 replay semantics (a
    # same-user replay returns the row without any call). The row lands
    # origin=generated with EMPTY sections — the sections fill live through
    # the /api/stream?op=lesson surface (createStreamTicket with op lesson).
    class CreateLesson < BaseMutation
      description "Create a generated lesson (AI 讲义) — a full Material with live section generation via the lesson stream op (epic-36). Scope by plan+node (② — the outline generates internally) or by material+echoed outline (① — no call); one lesson per node / per source material; the client uuid replays deterministically."

      argument :client_uuid, String,
               required: true,
               description: "The client-supplied lesson uuid — the replay key (delta 3). A same-user replay returns the existing lesson without a provider call."
      argument :language, String,
               required: true,
               description: "The lesson's generation language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."
      argument :plan_id, String,
               required: false,
               description: "② only: the plan's uuid (with nodeId — the node's plan)."
      argument :node_id, String,
               required: false,
               description: "② only: the plan node's uuid — needs ≥1 confirmed material mapping (an unmapped node refuses VALIDATION_FAILED)."
      argument :material_id, String,
               required: false,
               description: "① only: the source material's uuid — parsed with ≥1 sections, never a generated lesson."
      argument :outline, [ Types::Ai::LessonOutlineChapterInput ],
               required: false,
               description: "① only: the echoed proposeLessonOutline output (title + sourceSectionIds per chapter) — re-validated server-side (≤8 chapters, unique titles, every id resolving on the source)."

      field :material, Types::MaterialType,
            null: false,
            description: "The created (or replayed / already-existing) lesson — origin=generated, sections empty, generation.outline placeholders pending."

      def resolve(client_uuid:, language:, plan_id: nil, node_id: nil, material_id: nil, outline: nil)
        command_result(::Ai::CreateLessonCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          language: language,
          plan_id: plan_id,
          node_id: node_id,
          material_id: material_id,
          outline: outline&.map(&:to_h)
        ))
      end
    end
  end
end
