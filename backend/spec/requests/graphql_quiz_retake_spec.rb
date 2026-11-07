# frozen_string_literal: true

require "rails_helper"

# retakeQuizSession on the wire (epic P2-09 T4, FR-42): the auth guard, the
# payload shape (the NEW session rides back — the web navigates the flow route
# with its id), the typed failure matrix (uniform NOT_FOUND; VALIDATION_FAILED
# on a non-completed session), and the quizHistoryHub read-back (the retake's
# new session appears alongside the old one — the history is the hub's read).
RSpec.describe "GraphQL retakeQuizSession (epic P2-09 T4)", type: :request do
  around do |example|
    keys = %w[AI_API_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["AI_API_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "retaker@example.com", password: password) }
  let(:token) { token_for(user.email) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan) }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
    ])
  end
  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete).and_return({ questions: [
      { nodeId: node.id, kind: "choice", prompt: "How is every row scoped?", options: %w[user_id email],
        correctOptionIndex: 0, sourceMaterialId: material.id, sourceSectionId: "sec-1",
        keywords: [ "user_id" ], explanation: "By the user_id foreign key." }
    ] }.to_json)
  end

  def retake(session_id, language: "zh")
    graphql(<<~GRAPHQL, token: token)
      mutation {
        retakeQuizSession(input: { sessionId: "#{session_id}", language: "#{language}" }) {
          session { id status mode planId taskId }
        }
      }
    GRAPHQL
  end

  it "answers UNAUTHORIZED without a token" do
    result = graphql("mutation { retakeQuizSession(input: { sessionId: \"#{SecureRandom.uuid}\", language: \"zh\" }) { session { id } } }")
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end

  it "returns the NEW session: distinct id, same scope + mode, active — and the hub history grows by one" do
    old_session = create(:quiz_session, user: user, plan: plan, mode: "choice",
                                        status: "completed", completed_at: Time.current)

    result = retake(old_session.id)
    payload = result.dig("data", "retakeQuizSession", "session")
    aggregate_failures do
      expect(payload["id"]).to be_present
      expect(payload["id"]).not_to eq(old_session.id)
      expect(payload["planId"]).to eq(plan.id)
      expect(payload["taskId"]).to be_nil
      expect(payload["mode"]).to eq("choice")
      expect(payload["status"]).to eq("active")
    end

    readback = graphql("query { quizHistoryHub { sessionId mode } }", token: token)
    history = readback.dig("data", "quizHistoryHub")
    aggregate_failures do
      expect(history.map { |row| row["sessionId"] }).to contain_exactly(old_session.id, payload["id"])
      expect(history.map { |row| row["mode"] }).to all(eq("choice"))
    end
  end

  it "refuses a non-completed session with VALIDATION_FAILED on the wire" do
    active = create(:quiz_session, user: user, plan: plan)

    result = retake(active.id)
    expect(error_code(result)).to eq("VALIDATION_FAILED")
    expect(user.ai_usage_counters).to be_empty
  end

  it "reads unknown, foreign, and malformed ids as uniform NOT_FOUND" do
    foreign = create(:quiz_session, status: "completed")

    aggregate_failures do
      expect(error_code(retake(SecureRandom.uuid))).to eq("NOT_FOUND")
      expect(error_code(retake(foreign.id))).to eq("NOT_FOUND")
      expect(error_code(retake("not-a-uuid"))).to eq("NOT_FOUND")
    end
  end

  it "rides CAP_REACHED through the closed enum when the day's cap is spent" do
    session = create(:quiz_session, user: user, plan: plan, status: "completed", completed_at: Time.current)
    create(:ai_usage_counter, user: user, call_count: 50)

    expect(error_code(retake(session.id))).to eq("CAP_REACHED")
  end
end
