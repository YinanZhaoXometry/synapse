# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateNoteCommand (FR-40, epic P2-12 T1; delta decisions 1+4+5) against
# a stubbed adapter — the note contract: scope correctness (plan/node/material
# assemblies each ground on the right materials), replay-on-clientUuid (a
# same-user replay returns the existing note WITHOUT a provider call; a
# foreign uuid is VALIDATION_FAILED), one cap-counted provider call, the
# model's enrichment markers kept verbatim in the body AND extracted into the
# enrichment array, and the user-requested annotation placed at the end (or
# after the anchor paragraph when the enrichAt text matches one).
RSpec.describe Ai::GenerateNoteCommand do
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
  let(:plan) { create(:study_plan, user: user, topic: "Distributed systems") }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0) }
  let(:plan_material) do
    create(:material, user: user, plan: plan, title: "Plan-wide notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" }
    ])
  end
  let(:node_material) do
    create(:material, user: user, plan: plan, node: node, attachment_scope: "node",
                      title: "Node-pinned notes", sections: [
                        { "id" => "sec-pinned", "title" => "Pinned", "text" => "only the node sees this" }
                      ])
  end
  let(:adapter) { double("client") }
  let(:completions) { [] } # every complete(messages) call's joined prompt text, in order

  before do
    node
    plan_material
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      reply
    end
  end

  # The provider's reply — a standalone markdown note with two AI-placed
  # markers (the prompt's [[enrich|kind|suggestion]] contract) and an H1
  # title line.
  let(:reply) do
    <<~MD
      # Distributed systems in one note

      Raft elects a leader and replicates the log.

      [[enrich|diagram|Raft leader election across three nodes]]

      Chain replication passes writes down a chain.

      [[enrich|chart|failure detection latency comparison]]
    MD
  end

  def call(scope: "plan", plan_id: plan.id, node_id: nil, material_id: nil, enrich_at: nil,
           language: "zh", client_uuid: SecureRandom.uuid)
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      scope: scope,
      language: language,
      plan_id: plan_id,
      node_id: node_id,
      material_id: material_id,
      enrich_at: enrich_at
    )
  end

  describe "scope correctness (fixture grounding)" do
    it "plan, node, and material scopes each ground on their own material pool (FR-44)" do
      node_material

      call(scope: "plan", plan_id: plan.id)
      expect(completions.sole).to include("leader election and log replication")
      expect(completions.sole).not_to include("only the node sees this")

      call(scope: "node", node_id: node.id, plan_id: nil)
      expect(completions.second).to include("leader election and log replication")
      expect(completions.second).to include("only the node sees this")

      call(scope: "material", material_id: plan_material.id, plan_id: nil)
      expect(completions.third).to include("leader election and log replication")
    end

    it "carries the reply-language policy into the prompt (AD-16 — one parameter, one policy)" do
      call(language: "en")
      expect(completions.sole).to include("English")

      call(language: "zh", client_uuid: SecureRandom.uuid)
      expect(completions.second).to include("简体中文")
    end
  end

  describe "persistence + the cap" do
    it "persists one user-scoped note with the client uuid as its id, consuming one cap call" do
      uuid = SecureRandom.uuid

      result = call(client_uuid: uuid)
      expect(result).to be_success
      note = result.value![:note]
      expect(note.id).to eq(uuid)
      expect(note.user_id).to eq(user.id)
      expect(note.scope).to eq("plan")
      expect(note.plan_id).to eq(plan.id)
      expect(note.node_id).to be_nil
      expect(note.material_id).to be_nil
      expect(note.title).to eq("Distributed systems in one note")
      expect(note.targeting).to eq([])
      expect(user.ai_usage_counters.sole.call_count).to eq(1)
    end

    it "derives the title from the note's H1, falling back to the scope record's own name" do
      note = call.value![:note]
      expect(note.title).to eq("Distributed systems in one note")

      no_h1 = reply.lines.reject { |line| line.start_with?("# ") }.join
      allow(adapter).to receive(:complete).and_return(no_h1)
      fallback = call(client_uuid: SecureRandom.uuid).value![:note]
      expect(fallback.title).to eq(plan.topic)
    end

    it "keeps the enrichment markers verbatim in the body and extracts them into the array" do
      note = call.value![:note]
      expect(note.body).to include("[[enrich|diagram|Raft leader election across three nodes]]")
      expect(note.enrichment).to eq([
        { "kind" => "diagram", "suggestion" => "Raft leader election across three nodes" },
        { "kind" => "chart", "suggestion" => "failure detection latency comparison" }
      ])
    end

    it "fails INTERNAL when the provider returns no usable body" do
      allow(adapter).to receive(:complete).and_return("   \n  ")
      expect(call.failure.code).to eq(:INTERNAL)
    end
  end

  describe "replay on clientUuid" do
    it "returns the existing note for a same-user replay WITHOUT a provider call" do
      uuid = SecureRandom.uuid
      first = call(client_uuid: uuid)
      expect(first).to be_success

      completions.clear
      replay = call(client_uuid: uuid)
      expect(replay).to be_success
      expect(replay.value![:note].id).to eq(first.value![:note].id)
      expect(completions).to be_empty
      expect(user.ai_usage_counters.sole.call_count).to eq(1) # the replay never spends
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user's note" do
      foreign_note = create(:note, :material_scoped, user: create(:user))

      result = call(scope: "material", material_id: plan_material.id, plan_id: nil, client_uuid: foreign_note.id)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end
  end

  describe "validation matrix (nothing spent)" do
    it "refuses invalid language, malformed uuid shape, and an invalid scope value" do
      expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
      expect(call(client_uuid: "not-a-uuid").failure.code).to eq(:VALIDATION_FAILED)
      expect(call(scope: "stage").failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end

    it "refuses zero scope ids and several scope ids" do
      expect(call(plan_id: nil).failure.code).to eq(:VALIDATION_FAILED)
      expect(call(scope: "plan", plan_id: plan.id, material_id: plan_material.id).failure.code)
        .to eq(:VALIDATION_FAILED)
    end

    it "refuses a scope/id mismatch (the id must match the scope value)" do
      expect(call(scope: "node", plan_id: nil, material_id: plan_material.id).failure.code).to eq(:VALIDATION_FAILED)
    end

    it "answers NOT_FOUND uniformly for malformed, unknown, and foreign ids" do
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)
      foreign_node = create(:knowledge_node, user: other)
      foreign_material = create(:material, user: other)

      expect(call(plan_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(plan_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: foreign_node.id).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: foreign_material.id).failure.code).to eq(:NOT_FOUND)
      expect(completions).to be_empty
    end

    it "refuses a task node under the node scope (a note's node scope needs a plan node)" do
      task = create(:study_task, user: user)
      expect(call(scope: "node", plan_id: nil, node_id: task.node_id).failure.code).to eq(:VALIDATION_FAILED)
    end
  end

  describe "the user-requested annotation (enrichAt)" do
    it "appends the [[enrich|user|…]] marker at the END of the body by default" do
      note = call(enrich_at: "a timeline of the consensus rounds").value![:note]
      expect(note.body.strip).to end_with("[[enrich|user|a timeline of the consensus rounds]]")
      expect(note.enrichment.last).to eq({ "kind" => "user", "suggestion" => "a timeline of the consensus rounds" })
    end

    it "places the marker right after the paragraph containing the enrichAt substring when one matches" do
      note = call(enrich_at: "Raft elects a leader").value![:note]
      blocks = note.body.split("\n\n")
      anchor_index = blocks.index { |block| block.include?("Raft elects a leader") }
      expect(blocks[anchor_index + 1]).to eq("[[enrich|user|Raft elects a leader]]")
    end

    it "falls back to the end of the body when the anchor matches no paragraph" do
      note = call(enrich_at: "not in the note at all").value![:note]
      expect(note.body.strip).to end_with("[[enrich|user|not in the note at all]]")
    end

    it "adds no user marker when enrichAt is absent or blank" do
      plain = call.value![:note]
      expect(plain.enrichment.map { |marker| marker["kind"] }).to eq(%w[diagram chart])

      blank = call(enrich_at: "   ", client_uuid: SecureRandom.uuid).value![:note]
      expect(blank.body).to eq(plain.body)
    end
  end
end
