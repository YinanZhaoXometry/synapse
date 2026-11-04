# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateQuizCommand (ticket 03) against a stubbed adapter — no live
# provider calls in CI. The stub targets Ai::Provider.adapter (the seam's
# stub-ability contract, ticket 01), so the cap (ticket 02) stays real: every
# generation consumes exactly one counted call.
RSpec.describe Ai::GenerateQuizCommand do
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
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." },
      { "id" => "sec-2", "title" => "Commands", "text" => "Commands never raise; failures are typed." }
    ])
  end
  let(:adapter) { double("client") }
  let(:client_uuid) { SecureRandom.uuid }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def call(plan_id: plan.id, task_id: nil, mode: "open", language: "zh", uuid: client_uuid)
    described_class.call(
      current_user: user, client_uuid: uuid, mode: mode, language: language,
      plan_id: plan_id, task_id: task_id
    )
  end

  def question_payload(node_id: node.id, material_id: material.id, section_id: "sec-1", kind: "open", **overrides)
    {
      nodeId: node_id, kind: kind,
      prompt: "How is every row scoped?",
      options: kind == "choice" ? [ "user_id", "email" ] : nil,
      correctOptionIndex: kind == "choice" ? 0 : nil,
      sourceMaterialId: material_id, sourceSectionId: section_id,
      keywords: [ "user_id", "scope" ],
      explanation: "By the user_id foreign key on the row itself (AD-13)."
    }.merge(overrides)
  end

  def fenced(payload)
    "Certainly! Here are your questions:\n```json\n#{payload.to_json}\n```\nGood luck!"
  end

  it "generates and persists through the epic P2-3 command, consuming one cap call" do
    allow(adapter).to receive(:complete).and_return(fenced({ questions: [ question_payload ] }))

    result = call
    expect(result).to be_success
    session = result.value![:session]
    expect(session.mode).to eq("open")
    expect(session.plan_id).to eq(plan.id)
    question = result.value![:questions].sole
    expect(question.node_id).to eq(node.id)
    expect(question.source_material_id).to eq(material.id)
    expect(question.source_section_id).to eq("sec-1")
    expect(question.position).to eq(0)
    expect(user.ai_usage_counters.sole.call_count).to eq(1)
  end

  it "keeps only in-scope, well-shaped questions (the enum-guard), dropping the rest" do
    other_plan = create(:study_plan, user: user)
    foreign_node = create(:knowledge_node, user: user, plan: other_plan)
    payload = {
      questions: [
        question_payload,                                     # usable
        question_payload(kind: "truefalse"),                  # bad kind → dropped
        question_payload(node_id: foreign_node.id),           # out-of-scope node → dropped
        question_payload(section_id: "ghost"),                # unknown section → dropped
        question_payload(material_id: SecureRandom.uuid),     # unknown material → dropped
        question_payload(prompt: "  ")                        # empty prompt → dropped
      ]
    }
    allow(adapter).to receive(:complete).and_return(payload.to_json)

    result = call
    expect(result).to be_success
    expect(result.value![:questions].length).to eq(1)
  end

  it "keeps usable choice questions and drops malformed choice shapes" do
    payload = {
      questions: [
        question_payload(kind: "choice"),
        question_payload(kind: "choice", options: [ "only" ]),
        question_payload(kind: "choice", options: %w[a b], correctOptionIndex: 5),
        question_payload(kind: "choice", options: %w[a b], correctOptionIndex: "0")
      ]
    }
    allow(adapter).to receive(:complete).and_return(payload.to_json)

    result = call(mode: "choice")
    expect(result).to be_success
    kept = result.value![:questions].sole
    expect(kept.kind).to eq("choice")
    expect(kept.options).to eq([ "user_id", "email" ])
    expect(kept.correct_option_index).to eq(0)
  end

  it "fails INTERNAL when the reply carries no JSON" do
    allow(adapter).to receive(:complete).and_return("I cannot answer that.")
    result = call
    expect(result.failure.code).to eq(:INTERNAL)
    expect(result.failure.context[:message]).to include("no usable questions")
  end

  it "fails INTERNAL when no question survives normalization" do
    allow(adapter).to receive(:complete).and_return({ questions: [ { garbage: true } ] }.to_json)
    result = call
    expect(result.failure.code).to eq(:INTERNAL)
  end

  it "validates the language argument" do
    allow(adapter).to receive(:complete)
    result = call(language: "fr")
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
  end

  it "refuses a non-uuid client uuid and a garbage mode before anything is spent" do
    allow(adapter).to receive(:complete)
    expect(call(uuid: "not-a-uuid").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(mode: "truefalse").failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
    expect(user.ai_usage_counters).to be_empty # the cap was never touched
  end

  it "validates the scope: both, neither, and foreign are refused" do
    allow(adapter).to receive(:complete)
    other_user = create(:user)
    foreign_plan = create(:study_plan, user: other_user)

    expect(call(plan_id: plan.id, task_id: create(:study_task, user: user).id).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(plan_id: nil, task_id: nil).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
    expect(adapter).not_to have_received(:complete)
  end

  it "replays an owned session WITHOUT a provider call (a retry never spends twice)" do
    allow(adapter).to receive(:complete).and_raise(Ai::ProviderError, "must not be called")
    existing = create(:quiz_session, user: user, id: client_uuid, mode: "choice")

    result = call(mode: "open")
    expect(result).to be_success
    expect(result.value![:session].id).to eq(existing.id)
    expect(result.value![:session].mode).to eq("choice") # the original stands
    expect(result.value![:questions].length).to eq(existing.questions.count)
    expect(user.ai_usage_counters).to be_empty
  end

  it "refuses a foreign client uuid before generating" do
    other_user = create(:user)
    create(:quiz_session, user: other_user, id: client_uuid)
    allow(adapter).to receive(:complete)

    result = call
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(result.failure.context[:message]).to include("another user")
    expect(adapter).not_to have_received(:complete)
  end

  it "passes CAP_REACHED through from the seam" do
    create(:ai_usage_counter, user: user, call_count: 50)
    allow(adapter).to receive(:complete).and_return(fenced({ questions: [ question_payload ] }))

    result = call
    expect(result.failure.code).to eq(:CAP_REACHED)
    expect(adapter).not_to have_received(:complete)
  end

  it "works on a task scope with the task's single node" do
    task_node = create(:knowledge_node, user: user, title: "Task node")
    task_material = create(:material, user: user, sections: [ { "id" => "t-sec", "title" => "T", "text" => "task text" } ])
    task = create(:study_task, user: user, node: task_node, material: task_material)
    allow(adapter).to receive(:complete).and_return(
      fenced({ questions: [ question_payload(node_id: task.node.id, material_id: task.material.id, section_id: "t-sec") ] })
    )

    result = call(plan_id: nil, task_id: task.id, mode: "mix")
    expect(result).to be_success
    expect(result.value![:session].task_id).to eq(task.id)
    expect(result.value![:questions].sole.node_id).to eq(task.node.id)
  end
end
