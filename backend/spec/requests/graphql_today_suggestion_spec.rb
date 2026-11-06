# frozen_string_literal: true

require "rails_helper"
require "active_support/testing/time_helpers"

# The generateTodaySuggestion wire surface (epic-18 T2, spec decisions 7–11):
# the auth guard, the suggestion view payload (planId, nodeId, nodeTitle,
# reason, day), replay-before-spend on the wire (the same derived clientUuid
# re-reads the persisted row — the adapter fires once and the cap counter
# does not move), CAP_REACHED passthrough, honest INTERNAL on an unusable AI
# reply, and the uniform NOT_FOUND / VALIDATION_FAILED matrix. The command
# underneath has its own direct spec
# (spec/commands/ai/generate_today_suggestion_command_spec.rb); the adapter
# is stubbed at the seam (ticket 01's stub-ability contract). todayHub's own
# specs (spec/lib/hubs_today_spec.rb + spec/requests/graphql_hubs_spec.rb)
# pin the v1 heuristic UNTOUCHED — this surface never changes them.
RSpec.describe "GraphQL today suggestion surface (epic-18 T2)", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  around do |example|
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
    travel_to(now) { example.run }
  ensure
    travel_back
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:now) { Time.zone.parse("2026-11-06 09:30:00 UTC") }

  let(:adapter) { double("client") }

  let(:user) { create(:user, password: password) }
  let(:token) { token_for(user.email) }

  let(:plan) { create(:study_plan, user: user, topic: "Raft 复习计划") }
  let(:weakest) { create(:knowledge_node, user: user, plan_id: plan.id, order: 1, title: "Leader election") }
  let!(:mapping) do
    create(:material_node_mapping, user: user, material: create(:material, user: user, plan_id: plan.id),
                                   node: weakest, section_id: "sec-1", status: "confirmed")
  end

  let(:derived_uuid) { Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: plan.id, now: now) }

  let(:reply) do
    { "nodeId" => weakest.id, "nodeTitle" => weakest.title,
      "reason" => "掌握度最低（0/100），建议优先复习。" }.to_json
  end

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete).and_return(reply)
  end

  def generate(client_uuid: derived_uuid, plan_id: plan.id, language: "zh", auth_token: nil)
    graphql(
      <<~GRAPHQL, variables: { input: { clientUuid: client_uuid, language: language, planId: plan_id } }, token: (auth_token || token)
        mutation GenerateTodaySuggestion($input: GenerateTodaySuggestionInput!) {
          generateTodaySuggestion(input: $input) {
            todaySuggestion { planId nodeId nodeTitle reason day }
          }
        }
      GRAPHQL
    )
  end

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, language: "zh", planId: SecureRandom.uuid } }
          mutation GenerateTodaySuggestion($input: GenerateTodaySuggestionInput!) {
            generateTodaySuggestion(input: $input) { todaySuggestion { planId } }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "generateTodaySuggestion" do
    it "returns the persisted suggestion view (planId, nodeId, nodeTitle, reason, day)" do
      result = generate

      suggestion = result.dig("data", "generateTodaySuggestion", "todaySuggestion")
      aggregate_failures do
        expect(suggestion["planId"]).to eq(plan.id)
        expect(suggestion["nodeId"]).to eq(weakest.id)
        expect(suggestion["nodeTitle"]).to eq("Leader election") # resolves through the node — server truth
        expect(suggestion["reason"]).to eq("掌握度最低（0/100），建议优先复习。")
        expect(suggestion["day"]).to eq("2026-11-06") # the UTC day key convention
        expect(TodaySuggestion.count).to eq(1)
        expect(Ai::DailyCap.count_for(user)).to eq(1) # first generation consumes exactly one cap call
      end
    end

    it "replays the persisted row for free: same id, one adapter call, the cap counter untouched" do
      generate
      counter_after_first = Ai::DailyCap.count_for(user)

      replayed = generate

      suggestion = replayed.dig("data", "generateTodaySuggestion", "todaySuggestion")
      aggregate_failures do
        expect(suggestion).to be_present
        expect(TodaySuggestion.count).to eq(1)
        expect(Ai::DailyCap.count_for(user)).to eq(counter_after_first) # ZERO consumption on replay
        expect(adapter).to have_received(:complete).exactly(:once)
      end
    end

    it "refuses VALIDATION_FAILED on the wire for a uuid-shaped but non-derived client uuid" do
      result = generate(client_uuid: SecureRandom.uuid)

      aggregate_failures do
        expect(error_code(result)).to eq("VALIDATION_FAILED")
        expect(TodaySuggestion.count).to eq(0)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end

    it "refuses VALIDATION_FAILED on the wire for a non-uuid client uuid" do
      result = generate(client_uuid: "not-a-uuid")

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "refuses VALIDATION_FAILED for another user's suggestion uuid (cross-user replay)" do
      other = create(:user)
      other_plan = create(:study_plan, user: other)
      other_node = create(:knowledge_node, user: other, plan: other_plan)
      create(:today_suggestion, user: other, plan: other_plan, node: other_node)
      foreign_uuid = TodaySuggestion.where(user: other).sole.client_uuid

      result = generate(client_uuid: foreign_uuid)

      aggregate_failures do
        expect(error_code(result)).to eq("VALIDATION_FAILED")
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed plan id" do
      foreign = create(:study_plan, user: create(:user))

      aggregate_failures do
        expect(error_code(generate(plan_id: foreign.id))).to eq("NOT_FOUND")
        expect(error_code(generate(plan_id: SecureRandom.uuid))).to eq("NOT_FOUND")
        expect(error_code(generate(plan_id: "nope"))).to eq("NOT_FOUND")
        expect(adapter).not_to have_received(:complete)
      end
    end

    it "rides CAP_REACHED through the closed enum when the day's cap is spent" do
      capped_plan = create(:study_plan, user: user, topic: "Another plan")
      capped_node = create(:knowledge_node, user: user, plan_id: capped_plan.id, order: 1, title: "Log replication")
      create(:material_node_mapping, user: user, material: create(:material, user: user, plan_id: capped_plan.id),
                                     node: capped_node, section_id: "sec-1", status: "confirmed")
      user.ai_usage_counters.create!(day: now.utc.to_date, call_count: 50)

      result = generate(
        plan_id: capped_plan.id,
        client_uuid: Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: capped_plan.id, now: now)
      )

      aggregate_failures do
        expect(error_code(result)).to eq("CAP_REACHED")
        expect(adapter).not_to have_received(:complete)
        expect(TodaySuggestion.count).to eq(0)
      end
    end

    it "answers INTERNAL honestly when the AI reply is unusable (no fabricated fallback persists)" do
      allow(adapter).to receive(:complete).and_return(
        { "nodeId" => SecureRandom.uuid, "nodeTitle" => "凭空节点", "reason" => "编造的理由。" }.to_json
      )

      result = generate

      aggregate_failures do
        expect(error_code(result)).to eq("INTERNAL")
        expect(TodaySuggestion.count).to eq(0)
        expect(Ai::DailyCap.count_for(user)).to eq(1) # the provider call already counted (cap law)
      end
    end

    it "answers INTERNAL honestly when the plan has no usable suggestion target (nothing spent)" do
      bare_plan = create(:study_plan, user: user, topic: "No mapped nodes")

      result = generate(
        plan_id: bare_plan.id,
        client_uuid: Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: bare_plan.id, now: now)
      )

      aggregate_failures do
        expect(error_code(result)).to eq("INTERNAL")
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end
  end
end
