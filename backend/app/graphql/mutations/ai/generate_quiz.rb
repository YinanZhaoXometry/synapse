# frozen_string_literal: true

module Mutations
  module Ai
    # generateQuiz (AD-16/AD-5/AD-6, epic P2-5 ticket 03; targeting epic
    # P2-10 T5): server-side quiz generation — the server assembles the
    # scope's context, calls the provider, and persists through
    # Quiz::CreateSessionCommand. The client_uuid keeps its delta-3 replay
    # semantics: a same-user replay returns the existing session without a
    # provider call (a retry never spends two cap calls). The language
    # argument is the reply-language policy (one parameter, one policy —
    # AD-16). Scope: exactly ONE of planId / taskId / targeting.nodeId; the
    # targeting input (FR-21) is T5's selection bias — weak-spot quotas over
    # the plan scope, or the node Quick Test scope.
    class GenerateQuiz < BaseMutation
      description "Generate a node-attributed, materials-sourced quiz session in the given scope (plan, task, or targeting node) — server-side AI (FR-18/33/21)."

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
               description: "The plan scope's uuid (xor task_id and targeting.nodeId)."
      argument :task_id, String,
               required: false,
               description: "The task scope's uuid (xor plan_id and targeting.nodeId)."
      argument :targeting, Types::QuizTargetingInput,
               required: false,
               description: "Adaptive weak-spot targeting (FR-21): present without nodeId → weak-spot quotas over the plan scope; nodeId set → the node Quick Test scope (xor planId/taskId)."

      field :session, Types::QuizSessionType,
            null: false,
            description: "The created (or replayed) session."
      field :questions, [ Types::QuestionType ],
            null: false,
            description: "The session's questions in generation order."

      def resolve(client_uuid:, mode:, language:, plan_id: nil, task_id: nil, targeting: nil)
        command_result(::Ai::GenerateQuizCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          mode: mode,
          language: language,
          plan_id: plan_id,
          task_id: task_id,
          targeting: targeting&.to_h
        ))
      end
    end
  end
end
