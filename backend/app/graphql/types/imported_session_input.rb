# frozen_string_literal: true

module Types
  # One quiz session of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4). The session keeps the exactly-one-scope law the DB check
  # constraint pins; questionIds carries the Phase-1 question order — each
  # imported question's position derives from its index there.
  class ImportedSessionInput < Types::BaseInputObject
    description "One quiz session of a document being imported (Phase-1 QuizSession)."

    argument :id, String,
             required: true,
             description: "The session's client uuid (AD-12) — its key in the idempotent import."

    argument :mode, String,
             required: true,
             description: "\"open\" | \"choice\" | \"mix\" (the QuizMode vocabulary)."

    argument :plan_id, String,
             required: false,
             description: "The plan scope's uuid. Exactly one of planId/taskId."

    argument :task_id, String,
             required: false,
             description: "The task scope's uuid. Exactly one of planId/taskId."

    argument :status, String,
             required: false,
             description: "\"active\" | \"completed\" | \"abandoned\". Defaults to \"active\"."

    argument :question_ids, [ String ],
             required: false,
             description: "The session's question uuids in generation order (the Phase-1 array) — imported questions take their position from it."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the session was created on the client."

    argument :completed_at, Types::DateTime,
             required: false,
             description: "When the session completed (null while active/abandoned)."
  end
end
