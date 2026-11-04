# frozen_string_literal: true

module Import
  # Payload validation for the first-login document import (epic P2-8
  # ticket 03) — the pure-payload half of ImportDocumentCommand, split out
  # per the Materials::SectionValidation pattern so the command keeps the
  # orchestration. Every rule here is decided from the document hash alone
  # (no ownership reads — the command's foreign-uuid sweep owns those):
  #
  # - every client-supplied id is uuid-shaped and unique within its
  #   collection (the delta-3 triad's shape leg);
  # - the enum-ish strings stay inside the vocabularies the models pin
  #   (kind/parse state/parse failure reason, quiz mode/status, evidence
  #   outcome, flashcard difficulty, chat role);
  # - extracted text respects the delta-6 per-section cap (sections and
  #   reading positions alike);
  # - locators are the AD-2 shapes (pdf needs a page, markdown a section id);
  # - the linkage integrity the schema's FKs and unique indexes assume: the
  #   task triangle resolves INSIDE the document (a Phase-1 snapshot always
  #   carries it whole — node.task_id/material.task_id/task.material_id/
  #   task.node_id name document rows), imported questions hang off
  #   document sessions (the questionIds order is where their position
  #   comes from), and quiz sessions keep the exactly-one-scope law the DB
  #   check constraint pins.
  #
  # Cross-references that may resolve to the user's ALREADY-imported rows
  # (plan/material/node/session/question addresses outside the triangle)
  # are resolved by the command — they need the owner's scope, which this
  # concern deliberately does not read.
  module DocumentValidation
    # Returns the first typed Failure, or nil when the payload is clean.
    # (No bang: this never raises — the Failure object IS the result, per the
    # command-layer convention.)
    def validate_document(document)
      collection_failures = validate_ids!(document)
      return collection_failures if collection_failures

      per_entity_failure = validate_entities!(document)
      return per_entity_failure if per_entity_failure

      linkage_failure = validate_linkage!(document)
      return linkage_failure if linkage_failure

      nil
    end

    private

    # uuid shape + within-collection uniqueness for every id-bearing
    # collection (reading progress and chat threads have no ids — they are
    # keyed by their material).
    def validate_ids!(document)
      id_collections(document).each do |name, rows|
        rows.each do |row|
          unless row[:id].to_s.match?(Accounts::UUID_REGEX)
            return Failure(:VALIDATION_FAILED,
                           { message: "#{name} id is not uuid-shaped", field: name })
          end
        end
        if rows.map { |row| row[:id] }.uniq.size != rows.size
          return Failure(:VALIDATION_FAILED,
                         { message: "duplicate #{name} ids within the document", field: name })
        end
      end
      nil
    end

    # The per-entity payload rules — one pass per collection, first failure wins.
    def validate_entities!(document)
      document[:plans].each do |row|
        return blank_failure(:plans, :topic) if row[:topic].to_s.strip.empty?
      end

      document[:materials].each do |row|
        return blank_failure(:materials, :title) if row[:title].to_s.strip.empty?
        unless Material.kinds.key?(row[:kind].to_s)
          return Failure(:VALIDATION_FAILED, { message: "material kind is invalid", field: :materials })
        end
        if row[:parse_state] && !Material.parse_states.key?(row[:parse_state].to_s)
          return Failure(:VALIDATION_FAILED, { message: "parse state is invalid", field: :materials })
        end
        if row[:parse_failure_reason] && !Material.parse_failure_reasons.key?(row[:parse_failure_reason].to_s)
          return Failure(:VALIDATION_FAILED,
                         { message: "parse failure reason is invalid", field: :materials })
        end
        failure = validate_sections!(row[:sections])
        return failure if failure
      end

      document[:sessions].each do |row|
        unless QuizSession.modes.key?(row[:mode].to_s)
          return Failure(:VALIDATION_FAILED, { message: "quiz mode is invalid", field: :sessions })
        end
        unless QuizSession.statuses.key?(row[:status].to_s)
          return Failure(:VALIDATION_FAILED, { message: "quiz status is invalid", field: :sessions })
        end
        if row[:plan_id].blank? == row[:task_id].blank?
          return Failure(:VALIDATION_FAILED,
                         { message: "a session needs exactly one of planId/taskId", field: :sessions })
        end
      end

      document[:questions].each do |row|
        return blank_failure(:questions, :prompt) if row[:prompt].to_s.strip.empty?
        return blank_failure(:questions, :explanation) if row[:explanation].to_s.strip.empty?
        unless Question.kinds.key?(row[:kind].to_s)
          return Failure(:VALIDATION_FAILED, { message: "question kind is invalid", field: :questions })
        end
      end

      document[:evidence].each do |row|
        unless Quiz::OUTCOMES.include?(row[:outcome].to_s)
          return Failure(:VALIDATION_FAILED, { message: "evidence outcome is invalid", field: :evidence })
        end
      end

      document[:flashcards].each do |row|
        return blank_failure(:flashcards, :front) if row[:front].to_s.strip.empty?
        return blank_failure(:flashcards, :back) if row[:back].to_s.strip.empty?
        if row[:difficulty] && !Flashcard.difficulties.key?(row[:difficulty].to_s)
          return Failure(:VALIDATION_FAILED, { message: "flashcard difficulty is invalid", field: :flashcards })
        end
      end

      document[:mistakes].each do |row|
        failure = validate_locator!(row[:source_location], field: :mistakes)
        return failure if failure
      end

      document[:reading_progress].each do |row|
        failure = validate_locator!(row[:position][:locator], field: :readingProgress)
        return failure if failure
        if row[:position][:text].to_s.length > Materials::MAX_SECTION_CHARS
          return Failure(:VALIDATION_FAILED,
                         { message: "position text exceeds the #{Materials::MAX_SECTION_CHARS}-character cap",
                           field: :readingProgress })
        end
      end

      document[:chat_threads].each do |thread|
        thread[:messages].each do |message|
          unless Chat::ROLES.include?(message[:role].to_s)
            return Failure(:VALIDATION_FAILED, { message: "message role is invalid (user | companion)",
                                                 field: :chatThreads })
          end
          return blank_failure(:chatThreads, :text) if message[:text].to_s.strip.empty?
          unless message[:id].to_s.match?(Accounts::UUID_REGEX)
            return Failure(:VALIDATION_FAILED,
                           { message: "message id is not uuid-shaped", field: :chatThreads })
          end
          message[:citations].each do |locator|
            failure = validate_locator!(locator, field: :chatThreads)
            return failure if failure
          end
        end
      end

      nil
    end

    # The in-document linkage law: triangle references and question→session
    # addresses must name document rows (a Phase-1 snapshot carries its whole
    # graph), and every question id appears exactly once in its session's
    # questionIds (the position derivation reads that order).
    def validate_linkage!(document)
      task_ids = document[:tasks].map { |row| row[:id] }
      material_ids = document[:materials].map { |row| row[:id] }
      node_ids = document[:nodes].map { |row| row[:id] }
      session_ids = document[:sessions].map { |row| row[:id] }

      document[:nodes].each do |row|
        next if row[:task_id].blank? || task_ids.include?(row[:task_id])

        return missing_reference_failure(:nodes, :taskId)
      end
      document[:materials].each do |row|
        next if row[:task_id].blank? || task_ids.include?(row[:task_id])

        return missing_reference_failure(:materials, :taskId)
      end
      if document[:nodes].map { |row| row[:task_id] }.compact.uniq.size != document[:nodes].filter_map { |row| row[:task_id] }.size
        return Failure(:VALIDATION_FAILED,
                       { message: "a task can own at most one node", field: :nodes })
      end
      if document[:materials].map { |row| row[:task_id] }.compact.uniq.size != document[:materials].filter_map { |row| row[:task_id] }.size
        return Failure(:VALIDATION_FAILED,
                       { message: "a task can study at most one material", field: :materials })
      end

      document[:tasks].each do |row|
        unless material_ids.include?(row[:material_id])
          return missing_reference_failure(:tasks, :materialId)
        end
        unless node_ids.include?(row[:node_id])
          return missing_reference_failure(:tasks, :nodeId)
        end
      end

      sessions_by_id = document[:sessions].index_by { |row| row[:id] }
      document[:questions].each do |row|
        session = sessions_by_id[row[:session_id]]
        return missing_reference_failure(:questions, :sessionId) unless session

        unless session[:question_ids].include?(row[:id])
          return Failure(:VALIDATION_FAILED,
                         { message: "a question is missing from its session's questionIds", field: :questions })
        end
      end
      document[:sessions].each do |row|
        if row[:question_ids].uniq.size != row[:question_ids].size
          return Failure(:VALIDATION_FAILED,
                         { message: "duplicate questionIds within one session", field: :sessions })
        end
      end
      nil
    end

    # Section text rides the shared Materials::SectionValidation rules
    # (blank id refused, delta-6 cap) — reuse, don't re-state.
    def validate_sections!(sections)
      sections.each do |section|
        if section[:id].to_s.strip.empty?
          return Failure(:VALIDATION_FAILED, { message: "section id is required", field: :materials })
        end
        next unless section[:text].to_s.length > Materials::MAX_SECTION_CHARS

        return Failure(:VALIDATION_FAILED,
                       { message: "section text exceeds the #{Materials::MAX_SECTION_CHARS}-character cap",
                         field: :materials })
      end
      nil
    end

    def id_collections(document)
      {
        plans: document[:plans], nodes: document[:nodes], materials: document[:materials],
        tasks: document[:tasks], sessions: document[:sessions], questions: document[:questions],
        evidence: document[:evidence], flashcards: document[:flashcards], mistakes: document[:mistakes],
        sectionMarkings: document[:section_markings]
      }
    end

    def blank_failure(collection, field)
      Failure(:VALIDATION_FAILED, { message: "#{field} is required", field: collection })
    end

    def missing_reference_failure(collection, field)
      Failure(:VALIDATION_FAILED,
              { message: "#{field} does not resolve within the document or the importer's own rows",
                field: collection })
    end
  end
end
