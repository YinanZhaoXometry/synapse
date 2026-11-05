# frozen_string_literal: true

module Export
  # The whole-document data export (AD-15, FR-30 — epic-14 T1; delta decision
  # 1): the caller's WHOLE document gathered in the import's shape, so the
  # round trip closes — export → importDocument on a fresh user → equality on
  # the structural counts/content. The inverse of ::Import::
  # ImportDocumentCommand, and deliberately its mirror: every collection,
  # every key, and every link is what DocumentInput accepts (the wire shape —
  # string-keyed, camelCase, the Phase-1 TS keys verbatim per AD-4), so a
  # client feeds the downloaded JSON straight back through the import
  # mutation; the query layer JSON-serializes the hash for the Blob download.
  #
  # Fidelity notes (the honest edges of the mirror):
  # - materials ride byteless and metadata-only, exactly as the import
  #   accepts — the re-attach invite is the bytes' only path;
  # - a session's questionIds are derived from the questions' stored
  #   positions (the api realizes the Phase-1 array as Question.position;
  #   the export derives it back — same order, verbatim);
  # - question rows carry no createdAt on the round trip: the import
  #   vocabulary has none (the Phase-1 shape never carried it), so the
  #   re-imported questions take the importer's clock — recorded, accepted;
  # - node rows DO carry createdAt (the import accepts it even though the
  #   Phase-1 TS shape lacked the key — more history preserved);
  # - Phase-2-only rows (annotations, notes, material↔node mappings, study
  #   focus sets, manual tasks) have no import vocabulary and don't ride;
  #   neither does a material's node attachment scope (epic-10) — a
  #   node-scoped material exports under its plan attachment, the import's
  #   only vocabulary;
  # - onboardingComplete rides no export: the api holds no onboarding state
  #   (the import argument is advisory) — carrying a guess would be a lie.
  #
  # Size posture (delta decision 1): no artificial cap — the import's bounds
  # (≤100k chars/section) are the importer's concern; the export ships what
  # exists. Synchronous v1 (the whole gather is a handful of scoped SELECTs;
  # the payload rides one GraphQL string field → client-side Blob download).
  #
  # Scoping is the logic (AD-13): every read runs through the caller's own
  # association paths — the command cannot name a row that is not theirs.
  class ExportDataCommand < ApplicationCommand
    # The document schema version this export writes (the Phase-1
    # SCHEMA_VERSION the import carries as its advisory `version`).
    VERSION = 1

    option :current_user

    def call
      Success(document: build_document)
    end

    private

    def build_document
      {
        "version" => VERSION,
        "plans" => current_user.study_plans.order(:created_at, :id)
                     .map { |row| plan_row(row) },
        "nodes" => current_user.knowledge_nodes.order(:created_at, :id)
                      .map { |row| node_row(row) },
        "materials" => current_user.materials.order(:created_at, :id)
                          .map { |row| material_row(row) },
        "tasks" => current_user.study_tasks.order(:created_at, :id)
                       .map { |row| task_row(row) },
        "sessions" => current_user.quiz_sessions.order(:created_at, :id)
                          .map { |row| session_row(row) },
        "questions" => current_user.questions.order(:session_id, :position, :id)
                            .map { |row| question_row(row) },
        "evidence" => current_user.evidence_records.order(:created_at, :id)
                          .map { |row| evidence_row(row) },
        "flashcards" => current_user.flashcards.order(:created_at, :id)
                            .map { |row| flashcard_row(row) },
        "mistakes" => current_user.mistake_entries.order(:created_at, :id)
                           .map { |row| mistake_row(row) },
        "sectionMarkings" => current_user.section_markings.order(:created_at, :id)
                                  .map { |row| section_marking_row(row) },
        "readingProgress" => current_user.reading_progresses.order(:created_at, :id)
                                  .map { |row| reading_progress_row(row) },
        "chatThreads" => current_user.chat_threads.order(:created_at, :id)
                              .map { |row| chat_thread_row(row) }
      }
    end

    # The jsonb columns ride VERBATIM (string-keyed TS keys, AD-2/delta 7) —
    # the api stores exactly the shapes the import accepts back.

    def plan_row(row)
      { "id" => row.id, "topic" => row.topic, "goal" => row.goal,
        "createdAt" => iso(row.created_at) }
    end

    def node_row(row)
      { "id" => row.id, "planId" => row.plan_id, "taskId" => row.task_id,
        "stage" => row.stage, "title" => row.title, "order" => row.order,
        "createdAt" => iso(row.created_at) }
    end

    def material_row(row)
      { "id" => row.id, "title" => row.title, "kind" => row.kind,
        "sizeBytes" => row.size_bytes, "planId" => row.plan_id, "taskId" => row.task_id,
        "parseState" => row.parse_state, "parseFailureReason" => row.parse_failure_reason,
        "sections" => row.sections, "createdAt" => iso(row.created_at) }
    end

    def task_row(row)
      { "id" => row.id, "materialId" => row.material_id, "nodeId" => row.node_id,
        "createdAt" => iso(row.created_at) }
    end

    def session_row(row)
      # The Phase-1 array, derived back from the stored generation order.
      question_ids = current_user.questions.where(session_id: row.id).order(:position, :id).ids
      { "id" => row.id, "planId" => row.plan_id, "taskId" => row.task_id,
        "mode" => row.mode, "status" => row.status, "questionIds" => question_ids,
        "createdAt" => iso(row.created_at), "completedAt" => iso(row.completed_at) }
    end

    def question_row(row)
      { "id" => row.id, "sessionId" => row.session_id, "nodeId" => row.node_id,
        "kind" => row.kind, "prompt" => row.prompt, "options" => row.options,
        "correctOptionIndex" => row.correct_option_index,
        "sourceMaterialId" => row.source_material_id, "sourceSectionId" => row.source_section_id,
        "keywords" => row.keywords, "explanation" => row.explanation }
    end

    def evidence_row(row)
      { "id" => row.id, "nodeId" => row.node_id, "sessionId" => row.session_id,
        "questionId" => row.question_id, "outcome" => row.outcome,
        "createdAt" => iso(row.created_at) }
    end

    def flashcard_row(row)
      { "id" => row.id, "materialId" => row.material_id, "nodeId" => row.node_id,
        "front" => row.front, "back" => row.back, "difficulty" => row.difficulty,
        "createdAt" => iso(row.created_at) }
    end

    def mistake_row(row)
      { "id" => row.id, "questionId" => row.question_id, "sessionId" => row.session_id,
        "nodeId" => row.node_id, "userAnswer" => row.user_answer,
        "sourceLocation" => row.source_location, "forfeited" => row.forfeited,
        "createdAt" => iso(row.created_at) }
    end

    def section_marking_row(row)
      { "id" => row.id, "materialId" => row.material_id, "sectionId" => row.section_id,
        "claimedAt" => iso(row.claimed_at), "clearedAt" => iso(row.cleared_at) }
    end

    def reading_progress_row(row)
      # No id exists on the Phase-1 shape — the row is keyed by its material.
      { "materialId" => row.material_id, "position" => row.position,
        "updatedAt" => iso(row.updated_at) }
    end

    def chat_thread_row(row)
      # No id either — keyed by its material; messages keep their
      # client-minted ids verbatim in the jsonb (AD-12).
      { "materialId" => row.material_id, "messages" => row.messages,
        "updatedAt" => iso(row.updated_at) }
    end

    # The wire's datetime format (Types::DateTime — ISO-8601), UTC, so a
    # re-import keeps the history's clock and the jsonb message stamps byte-
    # match their re-emitted forms. Nullable columns pass null through.
    def iso(time)
      time&.utc&.iso8601
    end
  end
end
