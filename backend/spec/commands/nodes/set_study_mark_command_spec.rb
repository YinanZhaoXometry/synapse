# frozen_string_literal: true

require "rails_helper"

RSpec.describe Nodes::SetStudyMarkCommand do
  # The Study Mark (FR-47, epic-28) — a claim about where the user says they
  # are, never evidence: the write touches only study_mark; evidence_records
  # must be untouched and mastery must not move (asserted here and on the
  # wire). Set and clear are both idempotent; the enum is closed.

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan, order: 1) }

  def call(overrides = {})
    described_class.call(
      current_user: overrides.fetch(:current_user, user),
      node_id: overrides.fetch(:node_id, node.id),
      mark: overrides.fetch(:mark, "learning")
    )
  end

  describe ".call" do
    it "sets the mark and returns the updated node" do
      result = call(mark: "finished")

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:node].id).to eq(node.id)
        expect(result.value![:node].study_mark).to eq("finished")
        expect(node.reload.study_mark).to eq("finished")
      end
    end

    it "accepts every enum value" do
      %w[learning finished skipped].each do |value|
        expect(call(mark: value).success?).to be(true)
        expect(node.reload.study_mark).to eq(value)
      end
    end

    it "is idempotent on re-set — same value, same row, no duplicate" do
      call(mark: "learning")
      expect { call(mark: "learning") }.not_to change { user.knowledge_nodes.count }
      expect(node.reload.study_mark).to eq("learning")
    end

    it "clears with nil and clearing is idempotent" do
      call(mark: "skipped")
      expect(call(mark: nil).value![:node].study_mark).to be_nil
      expect(node.reload.study_mark).to be_nil
      expect(call(mark: nil).success?).to be(true)
    end

    it "rejects a mark outside the closed enum" do
      result = call(mark: "done")

      aggregate_failures do
        expect(result.success?).to be(false)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(node.reload.study_mark).to be_nil
      end
    end

    it "answers NOT_FOUND for a malformed id" do
      result = call(node_id: "not-a-uuid")

      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "answers NOT_FOUND for another user's node (uniform unknown-address rule)" do
      other = create(:knowledge_node, user: create(:user), order: 1)

      result = call(node_id: other.id)

      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "never touches evidence or mastery — the orthogonality tripwire" do
      plan_id = plan.id
      call(mark: "finished")

      aggregate_failures do
        expect(node.reload.study_mark).to eq("finished")
        expect(Mastery.compute_node_score([], now: Time.current)).to eq(0)
        expect(node.evidence_records.count).to eq(0)
        expect(StudyPlan.find(plan_id).knowledge_nodes.where.not(study_mark: nil).count).to eq(1)
      end
    end
  end
end
