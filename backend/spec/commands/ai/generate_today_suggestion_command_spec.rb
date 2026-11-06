# frozen_string_literal: true

require "rails_helper"
require "active_support/testing/time_helpers"

# Ai::GenerateTodaySuggestionCommand (epic-18 T2, spec decisions 7–11)
# against a stubbed adapter — the GenerateStudyFocus/GenerateNote family
# shape: server-side candidate assembly (the SAME server-truth sources
# Hubs.today reads — Mastery.node_stats + confirmed mappings + open
# MistakeEntry rows), ONE cap-counted provider call, replay-before-spend on
# the deterministic per-(user, plan, UTC day) client uuid (an owned uuid
# returns the persisted row with ZERO provider calls and ZERO cap
# consumption), and honest failures: gate → VALIDATION_FAILED, foreign plan
# → NOT_FOUND, zero usable candidates → INTERNAL (nothing spent), an
# unusable AI reply → INTERNAL (the call already counted), CAP_REACHED
# passes through from the seam. The clock is pinned (travel_to) because the
# replay key's day half must not flip mid-example at the UTC midnight.
RSpec.describe Ai::GenerateTodaySuggestionCommand do
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

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user, topic: "Raft 复习计划") }
  # The candidate pool: weakest (no evidence, order 1) vs weak (one correct
  # record → 99 capped by the evidence gate, order 2); an unmapped node and
  # a mastered node exist but are NOT usable candidates.
  let(:weakest) { create(:knowledge_node, user: user, plan_id: plan.id, order: 1, title: "Leader election") }
  let(:weak) { create(:knowledge_node, user: user, plan_id: plan.id, order: 2, title: "Log replication") }
  let(:unmapped) { create(:knowledge_node, user: user, plan_id: plan.id, order: 3, title: "Snapshots") }
  let(:mastered) { create(:knowledge_node, user: user, plan_id: plan.id, order: 4, title: "Terms") }
  let(:material) { create(:material, user: user, plan_id: plan.id) }

  let!(:mappings) do
    [ weakest, weak, mastered ].map do |node|
      create(:material_node_mapping, user: user, material: material, node: node,
                                     section_id: "sec-#{node.order}", status: "confirmed")
    end
  end

  let!(:weak_evidence) do
    create(:evidence_record, user: user, node: weak, outcome: "correct",
                             created_at: now - 1.hour)
  end

  let!(:mastered_evidence) do
    [ 3, 2, 1 ].each do |hours_ago|
      create(:evidence_record, user: user, node: mastered, outcome: "correct",
                               created_at: now - hours_ago.hours)
    end
  end

  let!(:open_mistake) do
    question = create(:question, user: user, node: weakest,
                                 source_material: material, created_at: now - 2.hours)
    create(:mistake_entry, user: user, question: question, created_at: now - 2.hours)
  end

  let(:adapter) { double("client") }
  let(:completions) { [] } # every complete(messages) call's joined prompt text, in order

  # The provider's reply — the prompt's JSON contract: picks the weakest
  # candidate (Leader election) with a reason grounded in the server facts.
  let(:reply) do
    { "nodeId" => weakest.id, "nodeTitle" => weakest.title,
      "reason" => "掌握度最低（0/100），且有 1 道未复盘错题。" }.to_json
  end

  let(:derived_uuid) do
    Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: plan.id, now: now)
  end

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    stub_adapter_reply(reply)
  end

  # Re-stub helper: records the joined prompt text AND returns the given
  # reply (a bare and_return would drop the recording).
  def stub_adapter_reply(text)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      text
    end
  end

  def call(plan_id: plan.id, language: "zh", client_uuid: derived_uuid)
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      language: language,
      plan_id: plan_id
    )
  end

  describe "input validation (nothing spent on any refusal)" do
    it "refuses an invalid language" do
      result = call(language: "fr")

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:language)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end

    it "refuses a non-uuid client uuid (the delta-3 shape refusal)" do
      result = call(client_uuid: "not-a-uuid")

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:clientUuid)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end
  end

  describe "plan resolution (uniform NOT_FOUND — never an existence leak)" do
    it "refuses a malformed id" do
      expect(call(plan_id: "nope").failure.code).to eq(:NOT_FOUND)
    end

    it "refuses an unknown id" do
      expect(call(plan_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
    end

    it "refuses a foreign plan with the SAME code as an unknown one" do
      foreign = create(:study_plan, user: create(:user))

      result = call(plan_id: foreign.id)

      aggregate_failures do
        expect(result.failure.code).to eq(:NOT_FOUND)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end
  end

  describe "replay-before-spend (spec decision 9 — the day's row re-reads for free)" do
    it "returns the persisted row on the owned uuid with ZERO provider calls and ZERO cap consumption" do
      first = call
      expect(first).to be_success
      counter_after_first = Ai::DailyCap.count_for(user)
      expect(counter_after_first).to eq(1) # the first generation counted exactly one call

      replayed = call

      aggregate_failures do
        expect(replayed).to be_success
        expect(replayed.value![:today_suggestion].id).to eq(first.value![:today_suggestion].id)
        expect(Ai::DailyCap.count_for(user)).to eq(counter_after_first) # the counter did not move
        expect(adapter).to have_received(:complete).exactly(:once)
        expect(TodaySuggestion.count).to eq(1)
      end
    end

    it "answers the replay BEFORE the usable-candidate gate (a retry stays safe after the plan changes)" do
      first = call
      expect(first).to be_success
      mappings.each(&:destroy!)

      replayed = call

      expect(replayed).to be_success
      expect(replayed.value![:today_suggestion].id).to eq(first.value![:today_suggestion].id)
      expect(adapter).to have_received(:complete).exactly(:once)
    end

    it "refuses VALIDATION_FAILED when the client uuid belongs to another user's suggestion" do
      other = create(:user)
      other_plan = create(:study_plan, user: other)
      create(:today_suggestion, user: other, plan: other_plan,
                                node: create(:knowledge_node, user: other, plan: other_plan))
      foreign_uuid = TodaySuggestion.where(user: other).sole.client_uuid

      result = call(client_uuid: foreign_uuid)

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:clientUuid)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end
  end

  describe "the deterministic-key gate (the per-(plan, UTC day) law is server-enforced)" do
    it "refuses a uuid-shaped but non-derived client uuid VALIDATION_FAILED before anything is spent" do
      result = call(client_uuid: SecureRandom.uuid)

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:clientUuid)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
        expect(TodaySuggestion.count).to eq(0)
      end
    end

    it "accepts exactly the day's derived uuid — a different day's uuid refuses today" do
      tomorrow_key = Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: plan.id, now: now + 1.day)

      result = call(client_uuid: tomorrow_key)

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:clientUuid)
        expect(adapter).not_to have_received(:complete)
        expect(TodaySuggestion.count).to eq(0)
      end
    end
  end

  describe "candidate assembly (the SAME server-truth sources Hubs.today reads)" do
    it "rides ONLY the plan's non-mastered nodes with confirmed mappings, weakest first" do
      call

      prompt = completions.sole
      aggregate_failures do
        expect(prompt).to include("[node id=#{weakest.id}] Leader election — mastery 0/100, state uncovered, open mistakes 1")
        expect(prompt).to include("[node id=#{weak.id}] Log replication — mastery 99/100, state partial, open mistakes 0")
        expect(prompt.index("[node id=#{weakest.id}]")).to be < prompt.index("[node id=#{weak.id}]")
      end
    end

    it "never leaks an unmapped node, a mastered node, or any material content (title-only discipline)" do
      call

      prompt = completions.sole
      aggregate_failures do
        expect(prompt).not_to include(unmapped.title)
        expect(prompt).not_to include(mastered.title)
        expect(prompt).not_to include("sec-1") # no section ids — the facts block is titles + server state only
        expect(prompt).not_to include(material.title)
      end
    end

    it "counts OPEN mistake entries only (a resolved entry is reviewed — it stops feeding the context)" do
      open_mistake.update!(resolved: true)

      call

      expect(completions.sole)
        .to include("[node id=#{weakest.id}] Leader election — mastery 0/100, state uncovered, open mistakes 0")
    end

    it "scores through Mastery (the ONE scorer, AD-14) with the injected now" do
      call

      # The weak node's single correct record would read 100 without the
      # evidence gate — the 99 cap proves the score came through Mastery.
      expect(completions.sole).to include("mastery 99/100")
    end
  end

  describe "the reply contract (validated against the plan's actual candidates)" do
    it "lands the reply as the persisted suggestion with the server-owned node title" do
      stub_adapter_reply(
        { "nodeId" => weakest.id, "nodeTitle" => "模型回显的标题（被服务端真相覆盖）",
          "reason" => "得分最低，优先补齐。" }.to_json
      )

      result = call

      suggestion = result.value![:today_suggestion]
      aggregate_failures do
        expect(result).to be_success
        expect(suggestion.user_id).to eq(user.id)
        expect(suggestion.plan_id).to eq(plan.id)
        expect(suggestion.node_id).to eq(weakest.id)
        expect(suggestion.node.title).to eq("Leader election") # the wire's title resolves server-side
        expect(suggestion.reason).to eq("得分最低，优先补齐。")
        expect(suggestion.client_uuid).to eq(derived_uuid)
        expect(suggestion.day).to eq(now.utc.to_date)
      end
    end

    it "answers INTERNAL when the reply's nodeId is invented (an unusable AI reply fails honestly)" do
      allow(adapter).to receive(:complete).and_return(
        { "nodeId" => SecureRandom.uuid, "nodeTitle" => "凭空节点", "reason" => "编造。" }.to_json
      )

      result = call

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
        expect(TodaySuggestion.count).to eq(0)
        expect(Ai::DailyCap.count_for(user)).to eq(1) # the provider call already counted (cap law)
      end
    end

    it "answers INTERNAL when the reply names a REAL plan node outside the candidate vocabulary" do
      aggregate_failures do
        [ unmapped, mastered ].each do |outside|
          stub_adapter_reply(
            { "nodeId" => outside.id, "nodeTitle" => outside.title, "reason" => "为什么不是你？" }.to_json
          )
          # A failed generation persists nothing, so the SAME day key can
          # attempt again (no replay row exists).
          result = call
          expect(result.failure.code).to eq(:INTERNAL)
        end
        expect(TodaySuggestion.count).to eq(0)
      end
    end

    it "answers INTERNAL when the reply carries no usable reason (the card explains itself or nothing)" do
      stub_adapter_reply(
        { "nodeId" => weakest.id, "nodeTitle" => weakest.title, "reason" => "   " }.to_json
      )

      result = call

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
        expect(TodaySuggestion.count).to eq(0)
      end
    end

    it "answers INTERNAL when the reply parses to no JSON object" do
      stub_adapter_reply("no json here")

      expect(call.failure.code).to eq(:INTERNAL)
    end

    it "never persists a fabricated fallback (the client falls back to v1 — spec decision 9)" do
      stub_adapter_reply(
        { "nodeId" => SecureRandom.uuid, "nodeTitle" => "x", "reason" => "y" }.to_json
      )

      call

      expect(TodaySuggestion.count).to eq(0)
    end
  end

  describe "zero usable candidates (INTERNAL honestly, NOTHING spent)" do
    it "answers INTERNAL when the plan has no nodes" do
      empty_plan = create(:study_plan, user: user, topic: "Empty plan")

      result = call(plan_id: empty_plan.id,
                    client_uuid: Ai::TodaySuggestionKey.derive(user_id: user.id, plan_id: empty_plan.id, now: now))

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end

    it "answers INTERNAL when no node carries a confirmed mapping" do
      mappings.each { |mapping| mapping.update!(status: "proposed") }

      result = call

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end

    it "answers INTERNAL when every mapped node reads mastered" do
      # Make the only non-mastered candidates mastered (3+ fresh correct records each).
      [ weakest, weak ].each do |node|
        [ 4, 3, 2 ].each do |hours_ago|
          create(:evidence_record, user: user, node: node, outcome: "correct",
                                   created_at: now - hours_ago.hours)
        end
      end

      result = call

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:INTERNAL)
        expect(adapter).not_to have_received(:complete)
        expect(Ai::DailyCap.count_for(user)).to eq(0)
      end
    end
  end

  describe "the cap (AD-16 — suggestion generation is NOT exempt)" do
    it "answers CAP_REACHED from the seam before any HTTP" do
      user.ai_usage_counters.create!(day: now.utc.to_date, call_count: 50)

      result = call

      aggregate_failures do
        expect(result).to be_failure
        expect(result.failure.code).to eq(:CAP_REACHED)
        expect(adapter).not_to have_received(:complete)
        expect(TodaySuggestion.count).to eq(0)
      end
    end

    it "consumes exactly ONE cap call for the first generation" do
      call

      expect(Ai::DailyCap.count_for(user)).to eq(1)
    end
  end

  describe "the prompt (AD-16 posture)" do
    it "carries the reply contract and the target law" do
      call

      prompt = completions.sole
      aggregate_failures do
        expect(prompt).to include("ONLY allowed targets")
        expect(prompt).to include("Reply ONLY with JSON")
        expect(prompt).to include("nodeId")
      end
    end

    it "carries the reply-language policy into the prompt (AD-16 — one parameter, one policy)" do
      # Both attempts must stay UNPERSISTED (an unusable reply) so the same
      # day key can attempt twice without replaying.
      stub_adapter_reply("no json here")
      call(language: "en")
      expect(completions.first).to include("English")

      stub_adapter_reply(reply)
      call
      expect(completions.second).to include("简体中文")
    end
  end
end
