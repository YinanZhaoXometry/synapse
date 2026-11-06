# frozen_string_literal: true

require "rails_helper"

# DataloaderSources::EvidenceRecordsSource (epic P3-17 ticket 07 — first
# direct spec): the batched evidence load behind the per-node Mastery fields.
# The WIRE already pins the batching (graphql_mastery_scores_spec counts ONE
# EvidenceRecord Load for a plan-wide read); what no test asserted is the
# source's own contract — the explicit user_id scoping posture (the
# documented cross-user-leak guard) and the fetch's shape guarantees.
RSpec.describe DataloaderSources::EvidenceRecordsSource, type: :graphql do
  let(:user) { create(:user) }
  let(:node_a) { create(:knowledge_node, user: user) }
  let(:node_b) { create(:knowledge_node, user: user) }

  it "answers every requested node with its own evidence, in request order" do
    first = create(:evidence_record, user: user, node: node_a)
    second = create(:evidence_record, user: user, node: node_b)

    results = described_class.new(user.id).fetch([ node_b.id, node_a.id ])

    aggregate_failures do
      expect(results.length).to eq(2)
      expect(results[0].map(&:id)).to eq([ second.id ])
      expect(results[1].map(&:id)).to eq([ first.id ])
    end
  end

  it "answers a node with no evidence as an empty list (Mastery reads score 0)" do
    results = described_class.new(user.id).fetch([ node_a.id, node_b.id ])
    expect(results).to eq([ [], [] ])
  end

  it "scopes by the initializing user — a foreign user's rows never reach the fetch" do
    foreign_user = create(:user)
    create(:evidence_record, user: foreign_user, node: node_a, outcome: "wrong")
    own = create(:evidence_record, user: user, node: node_a)

    results = described_class.new(user.id).fetch([ node_a.id ])

    expect(results.sole.map(&:id)).to eq([ own.id ])
  end

  it "batches: N requested nodes answer with ONE query per Dataloader tick" do
    create(:evidence_record, user: user, node: node_a)
    create(:evidence_record, user: user, node: node_b)

    queries = 0
    subscription = ActiveSupport::Notifications.subscribe("sql.active_record") do |*_args, payload|
      queries += 1 if payload[:sql].to_s.start_with?("SELECT", "select")
    end

    results = nil
    GraphQL::Dataloader.with_dataloading do |dataloader|
      source = dataloader.with(described_class, user.id)
      # load_all hands the WHOLE key list to one fetch — the same
      # one-batch-per-tick contract the wire's field loads coalesce into.
      results = source.load_all([ node_a.id, node_b.id ])
    end
    ActiveSupport::Notifications.unsubscribe(subscription)

    aggregate_failures do
      expect(results.length).to eq(2)
      select_queries = queries # only SELECTs counted; factories ran before the subscription
      expect(select_queries).to eq(1)
    end
  end
end
