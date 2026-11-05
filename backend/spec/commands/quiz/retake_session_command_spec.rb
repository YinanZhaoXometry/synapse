# frozen_string_literal: true

require "rails_helper"

# Quiz::RetakeSessionCommand (epic P2-09 T4, FR-42): the hub retake — a
# COMPLETED session only, re-seeded from the OLD session's scope + mode through
# the ONE generation path (Ai::GenerateQuizCommand with a server-minted fresh
# client uuid), never a replay of graded answers (NFR-8: the new attempt's
# evidence lands fresh at answer time). Language rides the command (quiz
# sessions do not persist it); everything else derives from the old session.
# Deliberately NOT idempotent: every call mints another attempt.
#
# The adapter is stubbed at the seam (ticket 01's stub-ability contract) so the
# cap stays real: every retake consumes exactly one counted call.
RSpec.describe Quiz::RetakeSessionCommand do
  around do |example|
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Scope node") }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
    ])
  end
  let(:adapter) { double("client") }
  let(:old_session) do
    create(:quiz_session, user: user, plan: plan, mode: "choice", status: "completed", completed_at: Time.current)
  end

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete).and_return({ questions: [
      { nodeId: node.id, kind: "choice", prompt: "How is every row scoped?", options: %w[user_id email],
        correctOptionIndex: 0, sourceMaterialId: material.id, sourceSectionId: "sec-1",
        keywords: [ "user_id" ], explanation: "By the user_id foreign key." }
    ] }.to_json)
  end

  def call(session_id: old_session.id, language: "zh")
    described_class.call(current_user: user, session_id: session_id, language: language)
  end

  it "mints a DISTINCT completed-scope retake: new id, same plan + mode, fresh active session with its own questions" do
    result = call
    expect(result).to be_success

    new_session = result.value![:session]
    aggregate_failures do
      expect(new_session.id).not_to eq(old_session.id)
      expect(new_session.plan_id).to eq(plan.id)
      expect(new_session.task_id).to be_nil
      expect(new_session.mode).to eq("choice")
      expect(new_session.status).to eq("active")
      expect(new_session.completed_at).to be_nil
      expect(new_session.questions.length).to eq(1)
      # the fresh attempt carries its OWN question rows — never the old ones
      expect(new_session.questions.sole.prompt).to eq("How is every row scoped?")
      expect(new_session.question_ids).not_to eq(old_session.reload.question_ids)
      # the old attempt is untouched — terminal completed stays completed
      expect(old_session.reload.status).to eq("completed")
    end
  end

  it "retakes a task-scoped session onto the same task" do
    task = create(:study_task, user: user)
    task_session = create(:quiz_session, user: user, plan: nil, task: task, mode: "open",
                                         status: "completed", completed_at: Time.current)
    # the task scope's usable question — the task's own node + material
    allow(adapter).to receive(:complete).and_return({ questions: [
      { nodeId: task.node.id, kind: "open", prompt: "What scopes a task row?", options: nil,
        correctOptionIndex: nil, sourceMaterialId: task.material.id, sourceSectionId: "sec-1",
        keywords: [ "task_id" ], explanation: "Through the task triangle." }
    ] }.to_json)

    result = described_class.call(current_user: user, session_id: task_session.id, language: "en")
    expect(result).to be_success

    new_session = result.value![:session]
    aggregate_failures do
      expect(new_session.id).not_to eq(task_session.id)
      expect(new_session.plan_id).to be_nil
      expect(new_session.task_id).to eq(task.id)
      expect(new_session.mode).to eq("open")
      expect(new_session.status).to eq("active")
    end
  end

  it "is NOT idempotent by design: a repeated retake mints ANOTHER new attempt" do
    first = call.value![:session]
    second = call.value![:session]

    aggregate_failures do
      expect(second.id).not_to eq(first.id)
      expect(second.plan_id).to eq(first.plan_id)
      expect(user.quiz_sessions.where(status: "active").count).to eq(2)
    end
  end

  it "is cap-counted through the inner generation: ONE provider call, ONE counter increment per retake" do
    call

    aggregate_failures do
      expect(adapter).to have_received(:complete).once
      expect(user.ai_usage_counters.sole.call_count).to eq(1)
    end
  end

  it "refuses a non-completed session with VALIDATION_FAILED (active and abandoned both)" do
    active = create(:quiz_session, user: user, plan: plan)
    abandoned = create(:quiz_session, user: user, plan: plan, status: "abandoned")

    aggregate_failures do
      result = described_class.call(current_user: user, session_id: active.id, language: "zh")
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:message]).to include("completed")

      result = described_class.call(current_user: user, session_id: abandoned.id, language: "zh")
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end
    expect(adapter).not_to have_received(:complete) # nothing is spent on a refusal
    expect(user.ai_usage_counters).to be_empty
  end

  it "resolves the session through current_user: unknown, foreign, and malformed ids are uniform NOT_FOUND" do
    foreign = create(:quiz_session, status: "completed")

    aggregate_failures do
      expect(call(session_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(session_id: foreign.id).failure.code).to eq(:NOT_FOUND)
      expect(call(session_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
    end
    expect(adapter).not_to have_received(:complete)
  end

  it "passes the language through to the inner generation (invalid language refused before a provider call)" do
    result = call(language: "fr")
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
    expect(user.ai_usage_counters).to be_empty
  end

  it "surfaces the inner generation's failures verbatim (CAP_REACHED passes through)" do
    create(:ai_usage_counter, user: user, call_count: 50)

    result = call
    expect(result.failure.code).to eq(:CAP_REACHED)
    expect(adapter).not_to have_received(:complete)
  end
end
