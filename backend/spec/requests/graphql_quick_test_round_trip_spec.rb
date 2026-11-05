# frozen_string_literal: true

require "rails_helper"

# The Quick Test round-trip over the wire (FR-14, epic-13 T2): generate in the
# material scope → answer → grade (recordEvidence) → the wrong answers land in
# the Mistakes Notebook (with their source section) while evidence attributes
# to the mapped node. The one spec that proves the reader's Quick Test feeds
# BOTH Phase-1 outputs (mistakes + evidence) through the EXISTING write path —
# nothing new is invented for the round-trip's back half.
RSpec.describe "Quick Test round-trip: generate → answer → grade → mistakes + evidence", type: :request do
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

  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  it "walks generate (material scope) → recordEvidence → evidence + mistake rows with node attribution" do
    user, token = user_with_token("quicktest-roundtrip@example.com")
    plan = create(:study_plan, user: user)
    node = create(:knowledge_node, user: user, plan: plan)
    material = create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." },
      { "id" => "sec-2", "title" => "Unmapped", "text" => "No confirmed mapping here." }
    ])
    create(:material_node_mapping, :confirmed, user: user, material: material, node: node, section_id: "sec-1")
    allow(adapter).to receive(:complete).and_return({ questions: [
      { nodeId: node.id, kind: "open", prompt: "How is every row scoped?", sourceMaterialId: material.id,
        sourceSectionId: "sec-1", keywords: [ "user_id" ], explanation: "By the user_id FK (AD-13)." },
      { nodeId: node.id, kind: "choice", prompt: "Pick the scoping key", options: %w[user_id email],
        correctOptionIndex: 0, sourceMaterialId: material.id, sourceSectionId: "sec-1",
        keywords: [ "user_id" ], explanation: "user_id." }
    ] }.to_json)

    generated = graphql(
      <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "mix", language: "en", materialId: material.id, targetCount: 4 } }, token: token
        mutation GenerateQuiz($input: GenerateQuizInput!) {
          generateQuiz(input: $input) {
            session { id planId status }
            questions { id nodeId kind sourceSectionId }
          }
        }
      GRAPHQL
    )
    payload = generated.dig("data", "generateQuiz")
    session_id = payload.dig("session", "id")
    expect(payload.dig("session", "planId")).to eq(plan.id)
    questions = payload["questions"]
    expect(questions.length).to eq(2)
    expect(questions.map { |q| q["nodeId"] }).to all(eq(node.id)) # the section's mapped node (AD-6)
    open_question, choice_question = questions

    # The learner answers: open wrong (no keyword terms), choice wrong.
    results = [
      { questionId: open_question["id"], outcome: "wrong", userAnswer: "no idea", forfeited: false },
      { questionId: choice_question["id"], outcome: "wrong", userAnswer: "email", forfeited: true }
    ]
    answered = graphql(
      <<~GRAPHQL, variables: { input: { sessionId: session_id, results: results } }, token: token
        mutation RecordEvidence($input: RecordEvidenceInput!) {
          recordEvidence(input: $input) {
            session { id status }
            evidence { id nodeId sessionId outcome }
            mistakes { id questionId nodeId userAnswer sourceLocation { kind page sectionId } forfeited }
          }
        }
      GRAPHQL
    )
    recorded = answered.dig("data", "recordEvidence")
    aggregate_failures do
      # The evidence half: one row per answer, attributed to the mapped node.
      expect(recorded.dig("session", "status")).to eq("completed")
      expect(recorded["evidence"].length).to eq(2)
      expect(recorded["evidence"].map { |e| e["nodeId"] }).to all(eq(node.id))
      # The mistakes half (FR-14's consequences): both wrongs feed the
      # Mistakes Notebook, each carrying its SOURCE SECTION — the markdown
      # locator mirror resolves the question's source section (sec-1), and the
      # forfeit rides its flag.
      expect(recorded["mistakes"].length).to eq(2)
      expect(recorded["mistakes"].map { |m| m.dig("sourceLocation", "sectionId") }).to all(eq("sec-1"))
      expect(recorded["mistakes"].map { |m| m["forfeited"] }).to contain_exactly(false, true)
      # Row truth, not just the payload: the persisted graph carries it too.
      expect(user.evidence_records.count).to eq(2)
      expect(user.mistake_entries.count).to eq(2)
      expect(user.mistake_entries.map(&:node_id)).to all(eq(node.id))
    end
  end
end
