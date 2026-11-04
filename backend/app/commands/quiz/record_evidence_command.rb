# frozen_string_literal: true

module Quiz
  # Record a finished quiz's graded answers — the Phase-1 quiz-repository
  # recordEvidence mirror (frontend/src/data/quiz-repository.ts): one
  # EvidenceRecord per answered question (node attribution read off the
  # question — AD-6), MistakeEntries for every wrong answer (FR-18: a forfeit
  # 「看答案」 is outcome "wrong" with its flag on the mistake, no mastery
  # credit), and the session's completion — the WHOLE batch validated first
  # and applied in ONE transaction (ticket AC; whole batch or nothing).
  #
  # Evidence writes are the only path that ever moves a Mastery Score
  # (GLOSSARY) — but this command only RECORDS outcomes; the 1/0.5/0 scoring
  # is epic-04's (AD-14). No score is computed here.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the session is
  # addressed through the owner's association path (delta 2 — unknown/foreign/
  # malformed → NOT_FOUND where Phase-1 trusted the client); a result
  # referencing a question outside the named session is VALIDATION_FAILED
  # (the cross-graph ownership check — Phase-1 only rejected globally-unknown
  # question ids); and grading a non-active session is refused (abandon is
  # "terminal and not resumable" per the repo's own contract) where Phase-1
  # would silently re-complete.
  class RecordEvidenceCommand < ApplicationCommand
    option :current_user
    option :session_id
    option :results

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500).
      return session_not_found unless session_id.to_s.match?(Accounts::UUID_REGEX)
      session = current_user.quiz_sessions.find_by(id: session_id)
      return session_not_found unless session

      unless session.status == "active"
        return Failure(:VALIDATION_FAILED,
                       { message: "quiz session is not active (terminal sessions are never resumed)",
                         field: :sessionId })
      end

      validation = validate_results!
      return validation if validation

      # Validate the whole batch before touching state (the Phase-1 atomicity
      # posture): every result must address a question OF THIS SESSION —
      # unknown, foreign, and cross-session ids all fail the same way, and
      # nothing is written.
      questions_by_id = session.questions.index_by(&:id)
      results.each do |result|
        next if questions_by_id.key?(result[:question_id])

        return Failure(:VALIDATION_FAILED,
                       { message: "a result references a question outside this session",
                         field: :results })
      end

      evidence = []
      mistakes = []
      ActiveRecord::Base.transaction do
        results.each do |result|
          question = questions_by_id.fetch(result[:question_id])
          evidence << current_user.evidence_records.create!(
            node: question.node,
            session: session,
            question: question,
            outcome: result[:outcome]
          )
          next unless result[:outcome] == "wrong"

          mistakes << current_user.mistake_entries.create!(
            question: question,
            session: session,
            node: question.node,
            user_answer: result[:user_answer].to_s,
            source_location: source_locator_for(question),
            forfeited: result[:forfeited] == true
          )
        end
        session.update!(status: "completed", completed_at: Time.current)
      end
      Success(evidence: evidence, mistakes: mistakes, session: session, nodes: touched_nodes(session), plan: session.plan)
    end

    private

    # The evidence batch's DISTINCT nodes, one fresh query through the owner's
    # association path (AD-13) — the live-update payload's node half (epic
    # P2-10 T3). The masteryScore/state fields compute on serialization
    # (KnowledgeNodeType), so the wire values are the post-write SERVER truth.
    def touched_nodes(session)
      current_user.knowledge_nodes
                  .where(id: session.questions.map(&:node_id).uniq)
                  .order(:created_at, :id)
    end

    private

    def validate_results!
      results.each do |result|
        unless Quiz::OUTCOMES.include?(result[:outcome].to_s)
          return Failure(:VALIDATION_FAILED, { message: "outcome is invalid", field: :results })
        end
      end
      # Intra-batch duplicate questions are refused (the epic P2-3 review,
      # P2-2): a repeated questionId would write TWO EvidenceRecords (and two
      # MistakeEntries) for one answer, double-counting epic-04's mastery.
      # Same law as CreateFlashcardsCommand's intra-batch clientUuid refusal —
      # the whole batch is refused before anything is written.
      question_ids = results.map { |result| result[:question_id] }
      if question_ids.uniq.size != question_ids.size
        return Failure(:VALIDATION_FAILED,
                       { message: "duplicate question ids within one batch", field: :results })
      end
      nil
    end

    # The questionSourceLocator mirror (frontend/src/data/quiz-repository.ts):
    # the locator a MistakeEntry carries, resolved from the question's material
    # source. Markdown → {kind, sectionId}; PDF section ids follow the parse
    # convention `page-N` — the page-1 fallback is unreachable for
    # adapter-generated questions, a guard for malformed data only, never a
    # fabricated citation for real flows. TS keys verbatim (jsonb, AD-2).
    def source_locator_for(question)
      if question.source_material.kind == "markdown"
        { "kind" => "markdown", "sectionId" => question.source_section_id }
      else
        page = /\Apage-(\d+)\z/.match(question.source_section_id)
        { "kind" => "pdf", "page" => page ? page[1].to_i : 1 }
      end
    end

    def session_not_found
      Failure(:NOT_FOUND, { message: "quiz session not found" })
    end
  end
end
