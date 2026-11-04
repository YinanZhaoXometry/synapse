# frozen_string_literal: true

module Types
  # The whole Phase-1 document as one value (epic P2-8 ticket 03; AD-4/AD-15
  # — the document's shape is the contract, read verbatim, never
  # transformed): the synapse-db:v1 snapshot's keys, one collection per
  # entity, materials byteless (the re-attach invite restores them). The
  # import is idempotent per row on the client uuids; version and
  # onboardingComplete ride along for contract fidelity — the api has no
  # server-side state for them yet (entry-gate flags stayed client-side).
  class DocumentInput < Types::BaseInputObject
    description "A whole Phase-1 local document (synapse-db:v1) being carried to the api — the first-login import's payload."

    argument :version, Int,
             required: false,
             description: "The document's schema version (Phase-1 SCHEMA_VERSION). Advisory."

    argument :onboarding_complete, Boolean,
             required: false,
             description: "The entry-gate flag as the client held it. Advisory — carried for contract fidelity; the api keeps no server-side onboarding state."

    argument :plans, [ Types::ImportedPlanInput ],
             required: false,
             description: "The document's plans."

    argument :nodes, [ Types::ImportedNodeInput ],
             required: false,
             description: "The document's knowledge nodes (plan nodes and task-owned ones)."

    argument :materials, [ Types::ImportedMaterialInput ],
             required: false,
             description: "The document's materials — metadata + extracted sections, NO bytes."

    argument :tasks, [ Types::ImportedTaskInput ],
             required: false,
             description: "The document's study tasks (the triangle travels whole)."

    argument :sessions, [ Types::ImportedSessionInput ],
             required: false,
             description: "The document's quiz sessions."

    argument :questions, [ Types::ImportedQuestionInput ],
             required: false,
             description: "The document's quiz questions."

    argument :evidence, [ Types::ImportedEvidenceInput ],
             required: false,
             description: "The document's evidence records (their timestamps ride along — Mastery reads them)."

    argument :flashcards, [ Types::ImportedFlashcardInput ],
             required: false,
             description: "The document's flashcards."

    argument :mistakes, [ Types::ImportedMistakeInput ],
             required: false,
             description: "The document's mistake entries."

    argument :reading_progress, [ Types::ImportedReadingProgressInput ],
             required: false,
             description: "The document's reading positions (keyed by material)."

    argument :chat_threads, [ Types::ImportedChatThreadInput ],
             required: false,
             description: "The document's Companion transcripts (keyed by material)."

    argument :section_markings, [ Types::ImportedSectionMarkingInput ],
             required: false,
             description: "The document's Mastery-Marking claims."
  end
end
