# frozen_string_literal: true

module Mutations
  module Ai
    # generateStudyFocus (FR-17, epic-13 T4; OQ-1): server-side Study Focus
    # generation — the server assembles the material's annotations (the
    # distillation source, riding FIRST) plus the section index, makes ONE
    # cap-counted provider call, and persists the reply as the caller's ONE
    # active StudyFocusSet for the material (regeneration REPLACES the
    # items and bumps the generation counter). The clientUuid keeps its
    # delta-3 replay semantics: a same-user replay of the set's LAST
    # generation returns the set without a provider call (a retry never
    # spends two cap calls); a foreign uuid is VALIDATION_FAILED. The
    # material must carry ≥1 annotation — VALIDATION_FAILED honestly when
    # not (there is nothing to distill; the reader hides the action).
    class GenerateStudyFocus < BaseMutation
      description "Generate the caller's Study Focus set for one material — core items distilled from the material's annotations (FR-17). Server-side AI: one AI call per generation (the daily cap counts it); the client uuid replays deterministically; regeneration replaces the active set."

      argument :client_uuid, String,
               required: true,
               description: "The client-supplied uuid — the replay key of the set's LAST generation (delta 3). A same-user replay returns the existing set without a provider call; regeneration mints a fresh one."

      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."

      argument :material_id, String,
               required: true,
               description: "The material to distill. Unknown, foreign, or malformed ids are NOT_FOUND; a material with no annotations is VALIDATION_FAILED (nothing to distill)."

      field :study_focus_set, Types::StudyFocusSetType,
            null: false,
            description: "The created (or replayed) active set."

      def resolve(client_uuid:, language:, material_id:)
        command_result(::Ai::GenerateStudyFocusCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          language: language,
          material_id: material_id
        ))
      end
    end
  end
end
