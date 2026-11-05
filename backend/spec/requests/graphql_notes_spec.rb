# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL notes surface (epic P2-12 T1, FR-40)", type: :request do
  # The wire behavior: auth guard, the user-scoped notes read (plan + node +
  # material scopes ride the ONE plan list), and the generateNote payload
  # shape + CAP_REACHED on the wire. The command underneath has its own
  # direct spec (spec/commands/ai/generate_note_command_spec.rb); the
  # adapter is stubbed at the seam (ticket 01's stub-ability contract).
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

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token" do
      uuid = SecureRandom.uuid
      operations = [
        "query { notes(planId: \"#{uuid}\") { id } }",
        "mutation { generateNote(input: { clientUuid: \"#{uuid}\", scope: \"plan\", language: \"zh\", " \
          "planId: \"#{uuid}\" }) { note { id } } }"
      ]
      operations.each do |operation|
        expect(error_code(graphql(operation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "notes(planId:)" do
    it "lists the plan's notes — plan, node, AND material scopes — newest first, user-scoped" do
      user, token = user_with_token("notes-reader@example.com")
      plan = create(:study_plan, user: user)
      other_plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan)

      old = create(:note, user: user, plan: plan, created_at: 2.days.ago)
      middle = create(:note, :node_scoped, user: user, node: node, created_at: 1.day.ago)
      newest = create(:note, :material_scoped, user: user, material: material)
      create(:note, user: user, plan: other_plan) # another plan's note never rides
      create(:note, :material_scoped, user: create(:user), material: create(:material, user: create(:user)))

      result = graphql(
        <<~GRAPHQL, variables: { planId: plan.id }, token: token
          query Notes($planId: String!) {
            notes(planId: $planId) { id title scope scopeId enrichment { kind suggestion } targeting createdAt }
          }
        GRAPHQL
      )
      notes = result.dig("data", "notes")
      expect(notes.map { |note| note["id"] }).to eq([ newest.id, middle.id, old.id ])
      expect(notes[0]["scope"]).to eq("material")
      expect(notes[0]["scopeId"]).to eq(material.id)
      expect(notes[0]["targeting"]).to eq([])
      expect(notes[1]["scope"]).to eq("node")
      expect(notes[1]["scopeId"]).to eq(node.id)
      expect(notes[2]["scope"]).to eq("plan")
      expect(notes[2]["scopeId"]).to eq(plan.id)
      expect(notes[2]["enrichment"]).to eq([])
    end

    it "answers NOT_FOUND for a foreign or unknown plan id" do
      user, token = user_with_token("notes-scoped@example.com")
      create(:study_plan, user: user)
      foreign = create(:study_plan, user: create(:user))

      expect(error_code(graphql("query { notes(planId: \"#{foreign.id}\") { id } }", token: token))).to eq("NOT_FOUND")
      expect(error_code(graphql("query { notes(planId: \"nope\") { id } }", token: token))).to eq("NOT_FOUND")
    end
  end

  describe "generateNote" do
    it "returns the persisted note over the wire; CAP_REACHED rides the closed enum" do
      user, token = user_with_token("notes-writer@example.com")
      plan = create(:study_plan, user: user)
      allow(adapter).to receive(:complete).and_return(
        "# Raft in one note\n\nRaft elects a leader.\n\n[[enrich|diagram|leader election rounds]]\n"
      )

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, scope: "plan", language: "zh", planId: plan.id } }, token: token
          mutation GenerateNote($input: GenerateNoteInput!) {
            generateNote(input: $input) {
              note { id title body scope scopeId enrichment { kind suggestion } targeting createdAt }
            }
          }
        GRAPHQL
      )
      note = result.dig("data", "generateNote", "note")
      expect(note["title"]).to eq("Raft in one note")
      expect(note["body"]).to include("[[enrich|diagram|leader election rounds]]")
      expect(note["scope"]).to eq("plan")
      expect(note["scopeId"]).to eq(plan.id)
      expect(note["enrichment"]).to eq([ { "kind" => "diagram", "suggestion" => "leader election rounds" } ])
      expect(note["targeting"]).to eq([])
      expect(note["createdAt"]).to be_present

      user.ai_usage_counters.sole.update!(call_count: 50) # the first call consumed one
      capped = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, scope: "plan", language: "zh", planId: plan.id } }, token: token
          mutation GenerateNote($input: GenerateNoteInput!) {
            generateNote(input: $input) { note { id } }
          }
        GRAPHQL
      )
      expect(error_code(capped)).to eq("CAP_REACHED")
    end

    it "replays the same client uuid without a provider call and keeps VALIDATION_FAILED for a foreign uuid" do
      user, token = user_with_token("notes-replay@example.com")
      plan = create(:study_plan, user: user)
      allow(adapter).to receive(:complete).and_return("# A note\n\nBody.")

      uuid = SecureRandom.uuid
      first = graphql(
        "mutation { generateNote(input: { clientUuid: \"#{uuid}\", scope: \"plan\", language: \"zh\", " \
          "planId: \"#{plan.id}\" }) { note { id } } }", token: token
      )
      expect(first.dig("data", "generateNote", "note", "id")).to eq(uuid)
      expect(adapter).to have_received(:complete).once

      replay = graphql(
        "mutation { generateNote(input: { clientUuid: \"#{uuid}\", scope: \"plan\", language: \"zh\", " \
          "planId: \"#{plan.id}\" }) { note { id } } }", token: token
      )
      expect(replay.dig("data", "generateNote", "note", "id")).to eq(uuid)
      expect(adapter).to have_received(:complete).once # unchanged — the replay never spends

      foreign = create(:note, :material_scoped, user: create(:user))
      conflict = graphql(
        "mutation { generateNote(input: { clientUuid: \"#{foreign.id}\", scope: \"plan\", language: \"zh\", " \
          "planId: \"#{plan.id}\" }) { note { id } } }", token: token
      )
      expect(error_code(conflict)).to eq("VALIDATION_FAILED")
    end
  end

  describe "generateNote targeting (FR-22, epic P2-12 T2)" do
    it "carries the weakSpot input shape on the wire and returns the allocation as the note's targeting" do
      user, token = user_with_token("notes-weakspot@example.com")
      plan = create(:study_plan, user: user)
      weak = create(:knowledge_node, user: user, plan: plan, title: "Weak node", order: 0)
      strong = create(:knowledge_node, user: user, plan: plan, title: "Strong node", order: 1)
      create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Raft", "text" => "leader election" }
      ])
      3.times { create(:evidence_record, user: user, node: weak, outcome: "wrong") }
      3.times { create(:evidence_record, user: user, node: strong, outcome: "correct") }
      allow(adapter).to receive(:complete).and_return("# A note\n\nBody.")

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, scope: "plan", language: "zh", planId: plan.id, targeting: { mode: "weakSpot" } } }, token: token
          mutation GenerateNote($input: GenerateNoteInput!) {
            generateNote(input: $input) {
              note { id targeting }
            }
          }
        GRAPHQL
      )
      note = result.dig("data", "generateNote", "note")
      expect(note["targeting"]).to eq([
        { "nodeId" => weak.id, "title" => "Weak node", "score" => "0", "mistakes" => 0, "share" => 2 },
        { "nodeId" => strong.id, "title" => "Strong node", "score" => "100", "mistakes" => 0, "share" => 0 }
      ])
    end

    it "refuses targeting on a node scope and an invalid mode with VALIDATION_FAILED" do
      user, token = user_with_token("notes-weakspot-refusals@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      allow(adapter).to receive(:complete)

      node_scoped = graphql(
        "mutation { generateNote(input: { clientUuid: \"#{SecureRandom.uuid}\", scope: \"node\", language: \"zh\", " \
          "nodeId: \"#{node.id}\", targeting: { mode: \"weakSpot\" } }) { note { id } } }", token: token
      )
      invalid_mode = graphql(
        "mutation { generateNote(input: { clientUuid: \"#{SecureRandom.uuid}\", scope: \"plan\", language: \"zh\", " \
          "planId: \"#{plan.id}\", targeting: { mode: \"banana\" } }) { note { id } } }", token: token
      )
      aggregate_failures do
        expect(error_code(node_scoped)).to eq("VALIDATION_FAILED")
        expect(error_code(invalid_mode)).to eq("VALIDATION_FAILED")
      end
      expect(adapter).not_to have_received(:complete)
    end
  end
end
