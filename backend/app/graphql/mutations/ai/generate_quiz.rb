# frozen_string_literal: true

module Mutations
  module Ai
    # generateQuiz (AD-16/AD-5/AD-6, epic P2-5 ticket 03; targeting epic
    # P2-10 T5; material scope epic-13 T2): server-side quiz generation —
    # the server assembles the scope's context, calls the provider, and
    # persists through Quiz::CreateSessionCommand. The client_uuid keeps its
    # delta-3 replay semantics: a same-user replay returns the existing
    # session without a provider call (a retry never spends two cap calls).
    # The language argument is the reply-language policy (one parameter, one
    # policy — AD-16). Scope: exactly ONE of planId / taskId / targeting.nodeId
    # / materialId (the FOUR-way xor — T2's material branch is the reader's
    # Quick Test, gated on ≥1 confirmed node mapping, AD-6); the targeting
    # input (FR-21) is T5's selection bias — weak-spot quotas over the plan
    # scope, or the node Quick Test scope.
    class GenerateQuiz < BaseMutation
      description "Generate a node-attributed, materials-sourced quiz session in the given scope (plan, task, targeting node, or material Quick Test) — server-side AI (FR-18/33/21/14)."

      argument :client_uuid, String,
               required: true,
               description: "The client-supplied session uuid — the replay key (delta 3). A same-user replay returns the existing session without a provider call."
      argument :mode, String,
               required: true,
               description: "The QuizMode: \"open\" | \"choice\" | \"mix\"."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."
      argument :plan_id, String,
               required: false,
               description: "The plan scope's uuid (xor task_id, targeting.nodeId, material_id)."
      argument :task_id, String,
               required: false,
               description: "The task scope's uuid (xor plan_id, targeting.nodeId, material_id)."
      argument :targeting, Types::QuizTargetingInput,
               required: false,
               description: "Adaptive weak-spot targeting (FR-21): present without nodeId → weak-spot quotas over the plan scope; nodeId set → the node Quick Test scope (xor planId/taskId/materialId)."
      argument :material_id, String,
               required: false,
               description: "The material Quick Test scope's uuid (FR-14, xor plan_id/task_id/targeting.nodeId) — the material needs ≥1 CONFIRMED section→node mapping (evidence is node-attributed, AD-6) or this refuses VALIDATION_FAILED."
      argument :section_ids, [ String ],
               required: false,
               description: "With material_id: narrows the Quick Test to 1–5 of the material's sections (each must exist on the material). Absent → every section rides. Never without material_id."
      argument :target_count, Integer,
               required: false,
               description: "With material_id: the Quick Test's question count, 3–5 (default 5). The real count may land lower honestly — questions citing unmapped sections drop."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The created (or replayed) session."
      field :questions, [ Types::QuestionType ],
            null: false,
            description: "The session's questions in generation order."

      def resolve(client_uuid:, mode:, language:, plan_id: nil, task_id: nil, targeting: nil,
                  material_id: nil, section_ids: nil, target_count: nil)
        command_result(::Ai::GenerateQuizCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          mode: mode,
          language: language,
          plan_id: plan_id,
          task_id: task_id,
          targeting: targeting&.to_h,
          material_id: material_id,
          section_ids: section_ids,
          target_count: target_count
        ))
      end
    end
  end
end
