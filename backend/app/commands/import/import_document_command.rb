# frozen_string_literal: true

module Import
  # The first-login document import (epic P2-8 ticket 03; AD-15): the whole
  # Phase-1 document arrives as ONE mutation and lands in ONE transaction —
  # the api command's home per the kickoff delta-review (the mutation was
  # missing from epic-03's set; it lands here).
  #
  # Idempotency is the delta-3 triad generalized to a whole document:
  #   · same-user replay with the same client uuids → the owned rows are
  #     SKIPPED (a mixed replay merges — only the missing rows are created),
  #     retry-safe;
  #   · any uuid owned by a DIFFERENT user → VALIDATION_FAILED, nothing
  #     written (ownership verification — never silently link, FR-4); the
  #     whole document is atomic, so a failure anywhere leaves no partial
  #     import behind;
  #   · a non-uuid (or a payload that breaks its own linkage) →
  #     VALIDATION_FAILED.
  #
  # The document's shape IS the contract (AD-4/AD-15): each row's client
  # uuid is the row's key (AD-12), createdAt timestamps travel with their
  # rows (the api's Mastery/streak read evidence created_at — an import
  # that reset the clock would rewrite the learner's history), and
  # materials arrive WITHOUT bytes (the re-attach step — epic-06 presign —
  # owns those; PDFs never re-attached render text-only). Reading progress
  # and chat threads carry no ids in the Phase-1 shape: they are keyed by
  # their material (1:1, unique index) and skip when the user already owns
  # one — the upsert never clobbers newer server state. Chat messages keep
  # their client-minted ids verbatim in the jsonb (AD-12); the thread row
  # itself is server-minted, exactly like appendChatMessage's.
  #
  # Deviations from the Phase-1 document (recorded here for the ticket):
  # session/question references must resolve inside the document or to the
  # importer's own rows (Phase-1 trusted the client's ids), quiz sessions
  # keep the exactly-one-scope law (the DB check constraint — Phase-1's
  # createQuizSession already required it), and section text stays under
  # the delta-6 cap (refused, never truncated).
  class ImportDocumentCommand < ApplicationCommand
    include DocumentValidation
    include ReadingLocators

    option :current_user
    option :document

    def call
      validation = validate_document(document)
      return validation if validation

      ownership = foreign_uuid_failure
      return ownership if ownership

      references = broken_reference_failure
      return references if references

      imported = 0
      skipped = 0
      ActiveRecord::Base.transaction do
        imported, skipped = import_rows
      end
      Success(imported: imported, skipped: skipped)
    end

    private

    # Insert phase — dependency order (plans → nodes → materials → tasks →
    # the triangle back-fill → sessions → questions → evidence → flashcards
    # → mistakes → markings → progress → threads), every row keyed by its
    # client uuid, owned rows skipped untouched (delta 3).
    def import_rows
      imported = 0
      skipped = 0

      document[:plans].each do |row|
        next skipped += 1 if current_user.study_plans.exists?(id: row[:id])

        current_user.study_plans.create!(id: row[:id], topic: row[:topic], goal: row[:goal],
                                         created_at: row[:created_at])
        imported += 1
      end

      # Nodes and materials insert with task_id null — the FKs point at
      # study_tasks, and the tasks (inserted next) point back at them. The
      # doc's own task_id links are back-filled right after the tasks land
      # (the study_task factory's insert dance, ticket 02 Comments).
      created_node_ids = []
      document[:nodes].each do |row|
        next skipped += 1 if current_user.knowledge_nodes.exists?(id: row[:id])

        current_user.knowledge_nodes.create!(id: row[:id], plan_id: row[:plan_id], task_id: nil,
                                             stage: row[:stage], title: row[:title], order: row[:order],
                                             created_at: row[:created_at])
        created_node_ids << row[:id]
        imported += 1
      end

      created_material_ids = []
      document[:materials].each do |row|
        next skipped += 1 if current_user.materials.exists?(id: row[:id])

        current_user.materials.create!(
          id: row[:id], plan_id: row[:plan_id], task_id: nil, title: row[:title], kind: row[:kind],
          size_bytes: row[:size_bytes].to_i,
          parse_state: row[:parse_state] || (row[:sections].any? ? "parsed" : "pending"),
          parse_failure_reason: row[:parse_state] == "failed" ? row[:parse_failure_reason] : nil,
          sections: sections_as_jsonb(row[:sections]), created_at: row[:created_at]
        )
        created_material_ids << row[:id]
        imported += 1
      end

      document[:tasks].each do |row|
        next skipped += 1 if current_user.study_tasks.exists?(id: row[:id])

        current_user.study_tasks.create!(id: row[:id], material_id: row[:material_id],
                                         node_id: row[:node_id], created_at: row[:created_at])
        imported += 1
      end
      back_fill_task_links(created_node_ids, created_material_ids)

      sessions_by_id = document[:sessions].index_by { |row| row[:id] }
      document[:sessions].each do |row|
        next skipped += 1 if current_user.quiz_sessions.exists?(id: row[:id])

        current_user.quiz_sessions.create!(id: row[:id], plan_id: row[:plan_id], task_id: row[:task_id],
                                           mode: row[:mode], status: row[:status],
                                           completed_at: row[:completed_at], created_at: row[:created_at])
        imported += 1
      end

      document[:questions].each do |row|
        next skipped += 1 if current_user.questions.exists?(id: row[:id])

        current_user.questions.create!(id: row[:id], session_id: row[:session_id], node_id: row[:node_id],
                                       kind: row[:kind], prompt: row[:prompt], options: row[:options],
                                       correct_option_index: row[:correct_option_index],
                                       source_material_id: row[:source_material_id],
                                       source_section_id: row[:source_section_id],
                                       keywords: row[:keywords], explanation: row[:explanation],
                                       position: sessions_by_id.fetch(row[:session_id])[:question_ids].index(row[:id]))
        imported += 1
      end

      document[:evidence].each do |row|
        next skipped += 1 if current_user.evidence_records.exists?(id: row[:id])

        current_user.evidence_records.create!(id: row[:id], node_id: row[:node_id],
                                              session_id: row[:session_id], question_id: row[:question_id],
                                              outcome: row[:outcome], created_at: row[:created_at])
        imported += 1
      end

      document[:flashcards].each do |row|
        next skipped += 1 if current_user.flashcards.exists?(id: row[:id])

        current_user.flashcards.create!(id: row[:id], material_id: row[:material_id], node_id: row[:node_id],
                                        front: row[:front], back: row[:back], difficulty: row[:difficulty],
                                        created_at: row[:created_at])
        imported += 1
      end

      document[:mistakes].each do |row|
        next skipped += 1 if current_user.mistake_entries.exists?(id: row[:id])

        current_user.mistake_entries.create!(id: row[:id], question_id: row[:question_id],
                                             session_id: row[:session_id], node_id: row[:node_id],
                                             user_answer: row[:user_answer].to_s,
                                             source_location: locator_as_jsonb(row[:source_location]),
                                             forfeited: row[:forfeited] == true, created_at: row[:created_at])
        imported += 1
      end

      document[:section_markings].each do |row|
        next skipped += 1 if current_user.section_markings.exists?(id: row[:id])

        current_user.section_markings.create!(id: row[:id], material_id: row[:material_id],
                                              section_id: row[:section_id], claimed_at: row[:claimed_at],
                                              cleared_at: row[:cleared_at])
        imported += 1
      end

      # Reading progress and chat threads have no client ids (the Phase-1
      # shapes key them by material) — 1:1 by material, skip when owned.
      # Skipped rows stand untouched: newer server state is never clobbered.
      document[:reading_progress].each do |row|
        next skipped += 1 if current_user.reading_progresses.exists?(material_id: row[:material_id])

        current_user.reading_progresses.create!(material_id: row[:material_id],
                                                position: position_as_jsonb(row[:position]),
                                                **thread_row_timestamps(row))
        imported += 1
      end

      document[:chat_threads].each do |row|
        next skipped += 1 if current_user.chat_threads.exists?(material_id: row[:material_id])

        current_user.chat_threads.create!(material_id: row[:material_id],
                                          messages: thread_messages_as_jsonb(row[:messages]),
                                          **thread_row_timestamps(row))
        imported += 1
      end

      [ imported, skipped ]
    end

    # The doc's own task linkage, applied once the tasks exist. Only rows
    # created in THIS call are back-filled — a replay-skipped row's original
    # links stand (delta 3).
    def back_fill_task_links(created_node_ids, created_material_ids)
      document[:nodes].each do |row|
        next if row[:task_id].blank? || created_node_ids.exclude?(row[:id])

        current_user.knowledge_nodes.find(row[:id]).update!(task_id: row[:task_id])
      end
      document[:materials].each do |row|
        next if row[:task_id].blank? || created_material_ids.exclude?(row[:id])

        current_user.materials.find(row[:id]).update!(task_id: row[:task_id])
      end
    end

    # The delta-3 ownership sweep: ANY uuid that already belongs to another
    # user fails the whole document before a single row is written.
    def foreign_uuid_failure
      ownership_collections.each do |name, (klass, assoc, rows)|
        rows.each do |row|
          next unless klass.exists?(id: row[:id]) && !current_user.send(assoc).exists?(id: row[:id])

          return Failure(:VALIDATION_FAILED,
                         { message: "#{name} id already belongs to another user", field: name })
        end
      end
      nil
    end

    # References resolve within the document OR to the importer's own rows.
    # The triangle + question→session legs are stricter (in-document only)
    # and are pinned by DocumentValidation; everything here may also address
    # already-imported rows (the merge replay). The FK VALUES themselves
    # travel verbatim — resolution is an integrity assertion, never a
    # transformation.
    def broken_reference_failure
      in_doc = in_document_reference_ids
      references.each do |collection, field, target_assoc, required|
        document[collection].each do |row|
          value = row[field]
          next if value.blank? && !required
          next if in_doc.key?(value) || current_user.send(target_assoc).exists?(id: value)

          return Failure(:VALIDATION_FAILED,
                         { message: "#{field} does not resolve within the document or the importer's own rows",
                           field: collection })
        end
      end
      nil
    end

    def in_document_reference_ids
      (document[:plans] + document[:nodes] + document[:materials] +
        document[:tasks] + document[:sessions] + document[:questions])
        .map { |row| row[:id] }.index_with { true }
    end

    # [collection, reference field, the owner's target association, required?]
    def references
      [
        [ :nodes, :plan_id, :study_plans, false ],
        [ :materials, :plan_id, :study_plans, false ],
        [ :sessions, :plan_id, :study_plans, false ],
        [ :sessions, :task_id, :study_tasks, false ],
        [ :questions, :node_id, :knowledge_nodes, true ],
        [ :questions, :source_material_id, :materials, true ],
        [ :evidence, :node_id, :knowledge_nodes, true ],
        [ :evidence, :session_id, :quiz_sessions, false ],
        [ :evidence, :question_id, :questions, false ],
        [ :flashcards, :material_id, :materials, true ],
        [ :flashcards, :node_id, :knowledge_nodes, false ],
        [ :mistakes, :question_id, :questions, true ],
        [ :mistakes, :session_id, :quiz_sessions, false ],
        [ :mistakes, :node_id, :knowledge_nodes, true ],
        [ :section_markings, :material_id, :materials, true ],
        [ :reading_progress, :material_id, :materials, true ],
        [ :chat_threads, :material_id, :materials, true ]
      ]
    end

    def ownership_collections
      {
        plans: [ StudyPlan, :study_plans, document[:plans] ],
        nodes: [ KnowledgeNode, :knowledge_nodes, document[:nodes] ],
        materials: [ Material, :materials, document[:materials] ],
        tasks: [ StudyTask, :study_tasks, document[:tasks] ],
        sessions: [ QuizSession, :quiz_sessions, document[:sessions] ],
        questions: [ Question, :questions, document[:questions] ],
        evidence: [ EvidenceRecord, :evidence_records, document[:evidence] ],
        flashcards: [ Flashcard, :flashcards, document[:flashcards] ],
        mistakes: [ MistakeEntry, :mistake_entries, document[:mistakes] ],
        sectionMarkings: [ SectionMarking, :section_markings, document[:section_markings] ]
      }
    end

    # The jsonb rows the factories pin: string-keyed, TS keys verbatim.
    def sections_as_jsonb(sections)
      sections.map { |section| { "id" => section[:id], "title" => section[:title], "text" => section[:text] } }
    end

    def position_as_jsonb(position)
      { "locator" => locator_as_jsonb(position[:locator]), "text" => position[:text].to_s }
    end

    # Chat messages keep their Phase-1 shape verbatim — client-minted ids,
    # TS keys (createdAt camelCase, per AppendMessageCommand's row shape).
    def thread_messages_as_jsonb(messages)
      messages.map do |message|
        {
          "id" => message[:id],
          "role" => message[:role].to_s,
          "text" => message[:text],
          "citations" => message[:citations].map { |locator| locator_as_jsonb(locator) },
          "createdAt" => (message[:created_at] || Time.current).utc.iso8601
        }
      end
    end

    # The two updatedAt-keyed rows: the doc's timestamp moves both columns
    # (creation time is unknowable from a Phase-1 snapshot; updated_at is
    # the honest one). Absent → Rails defaults (the server clock).
    def thread_row_timestamps(row)
      return {} unless row[:updated_at]

      { created_at: row[:updated_at], updated_at: row[:updated_at] }
    end
  end
end
