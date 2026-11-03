# frozen_string_literal: true

require "rails_helper"

RSpec.describe Quiz::RecordEvidenceCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:session) { create(:quiz_session, user: user, plan: plan) }
  let(:material) { create(:material, user: user, plan: plan) }
  let(:node) { create(:knowledge_node, user: user, plan: plan) }
  let(:question) { create(:question, user: user, session: session, node: node, source_material: material) }
  let(:other_question) { create(:question, user: user, session: session, node: node, source_material: material) }

  # The Phase-1 AnswerResult shape (frontend/src/data/quiz-repository.ts):
  # questionId/outcome/userAnswer/forfeited per answered question.
  def answer(question_record, outcome, user_answer: "an answer", forfeited: false)
    { question_id: question_record.id, outcome: outcome, user_answer: user_answer, forfeited: forfeited }
  end

  def call(overrides = {})
    described_class.call(
      current_user: user,
      session_id: session.id,
      results: [ answer(question, "correct") ],
      **overrides
    )
  end

  describe ".call" do
    it "writes one EvidenceRecord per answered question, attributed off the question (AD-6)" do
      result = call

      expect(result.success?).to be(true)
      evidence = result.value![:evidence]
      expect(evidence.length).to eq(1)
      record = evidence.first
      expect(record.user_id).to eq(user.id)
      expect(record.node_id).to eq(question.node_id)
      expect(record.session_id).to eq(session.id)
      expect(record.question_id).to eq(question.id)
      expect(record.outcome).to eq("correct")
      expect(record.created_at).to be_present
    end

    it "marks the session completed with the server-set completedAt (the batch is the completion)" do
      result = call

      session_row = result.value![:session]
      expect(session_row.status).to eq("completed")
      expect(session_row.completed_at).to be_present
      expect(session_row.reload.status).to eq("completed")
    end

    it "logs a MistakeEntry for a wrong answer with the derived markdown source locator" do
      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(question, "wrong", user_answer: "scoping lives in the view", forfeited: false) ]
      )

      mistakes = result.value![:mistakes]
      expect(mistakes.length).to eq(1)
      mistake = mistakes.first
      expect(mistake.question_id).to eq(question.id)
      expect(mistake.session_id).to eq(session.id)
      expect(mistake.node_id).to eq(question.node_id)
      expect(mistake.user_answer).to eq("scoping lives in the view")
      expect(mistake.forfeited).to be(false)
      # The questionSourceLocator mirror: markdown → {kind, sectionId} (TS keys verbatim).
      expect(mistake.source_location).to eq("kind" => "markdown", "sectionId" => "sec-1")
    end

    it "records a forfeit (「看答案」) as outcome wrong with the forfeited flag on the mistake" do
      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(question, "wrong", user_answer: "", forfeited: true) ]
      )

      evidence = result.value![:evidence]
      expect(evidence.first.outcome).to eq("wrong")
      mistake = result.value![:mistakes].first
      expect(mistake.forfeited).to be(true)
    end

    it "resolves a pdf question's locator to {kind, page} parsed from the page-N section id" do
      pdf = create(:material, user: user, plan: plan, kind: "pdf",
                              sections: [ { "id" => "page-7", "title" => "Page 7", "text" => "pdf text" } ])
      pdf_question = create(:question, user: user, session: session, node: node,
                                       source_material: pdf, source_section_id: "page-7")

      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(pdf_question, "wrong", user_answer: "guess", forfeited: false) ]
      )

      # The questionSourceLocator mirror: pdf page-N → {kind: "pdf", page: 7}.
      expect(result.value![:mistakes].first.source_location).to eq("kind" => "pdf", "page" => 7)
    end

    it "falls back to page 1 for a malformed pdf section id (the Phase-1 guard for malformed data only)" do
      pdf = create(:material, user: user, plan: plan, kind: "pdf")
      odd_question = create(:question, user: user, session: session, node: node,
                                       source_material: pdf, source_section_id: "not-a-page")

      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(odd_question, "wrong", user_answer: "guess", forfeited: false) ]
      )

      expect(result.value![:mistakes].first.source_location).to eq("kind" => "pdf", "page" => 1)
    end

    it "does not log mistakes for correct or partial outcomes" do
      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(question, "correct"), answer(other_question, "partial") ]
      )

      expect(result.value![:evidence].map(&:outcome)).to eq(%w[correct partial])
      expect(result.value![:mistakes]).to be_empty
      expect(user.mistake_entries.count).to eq(0)
    end

    it "writes the whole batch atomically: evidence and mistakes land together" do
      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [
          answer(question, "correct"),
          answer(other_question, "wrong", user_answer: "不知道", forfeited: false)
        ]
      )

      expect(result.value![:evidence].length).to eq(2)
      expect(result.value![:mistakes].length).to eq(1)
      expect(user.evidence_records.count).to eq(2)
      expect(user.mistake_entries.count).to eq(1)
      expect(user.mistake_entries.first.user_answer).to eq("不知道")
    end

    it "is atomic on a bad batch: nothing is written when one result addresses a question outside the session" do
      # A same-user question of a DIFFERENT session — the cross-graph violation
      # (the epic-01 standing note: every id in the payload must belong to the
      # same graph as the session).
      foreign_session_question = create(:question, user: user, node: node, source_material: material)

      result = described_class.call(
        current_user: user,
        session_id: session.id,
        results: [ answer(question, "correct"), answer(foreign_session_question, "correct") ]
      )

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.evidence_records.count).to eq(0)
      expect(user.mistake_entries.count).to eq(0)
      expect(session.reload.status).to eq("active")
      expect(session.completed_at).to be_nil
    end

    it "answers NOT_FOUND for another user's session (uniform NOT_FOUND, delta 2) and writes nothing" do
      foreign_session = create(:quiz_session, user: create(:user))

      result = call(session_id: foreign_session.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.evidence_records.count).to eq(0)
      expect(foreign_session.reload.status).to eq("active")
    end

    it "answers NOT_FOUND for an unknown or malformed session id" do
      aggregate_failures do
        unknown = call(session_id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(session_id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.evidence_records.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for an outcome outside correct|partial|wrong" do
      result = call(results: [ answer(question, "almost") ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.evidence_records.count).to eq(0)
    end

    it "fails VALIDATION_FAILED grading a non-active session (abandon is terminal — not resumable)" do
      session.update!(status: "completed", completed_at: Time.current)

      result = call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.evidence_records.count).to eq(0)
    end

    it "completes the session with an empty batch and no evidence (the Phase-1 mirror)" do
      result = call(results: [])

      expect(result.success?).to be(true)
      expect(result.value![:evidence]).to be_empty
      expect(result.value![:mistakes]).to be_empty
      expect(result.value![:session].reload.status).to eq("completed")
      expect(user.evidence_records.count).to eq(0)
    end
  end
end
