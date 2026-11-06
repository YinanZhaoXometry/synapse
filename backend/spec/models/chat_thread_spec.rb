# frozen_string_literal: true

require "rails_helper"

RSpec.describe ChatThread, type: :model do
  let(:user) { User.create!(email: "chat-thread-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Thread anchor", kind: "markdown", size_bytes: 256) }

  let(:model_attributes) { { user: user, material: material } }

  it_behaves_like "a user-owned uuid model"

  it "anchors 1:1 to a material — a second thread for the same material is rejected" do
    described_class.create!(model_attributes)

    expect { described_class.create!(model_attributes) }
      .to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "starts with an empty messages jsonb (no ChatMessage entity in the ER — embedded)" do
    thread = described_class.create!(model_attributes)

    expect(thread.messages).to eq([])
  end

  # The plan scope (epic-25 T1): the tutor page's thread anchors to the
  # plan instead of the material — exactly one of the two anchors is set
  # (the chat_threads_one_scope CHECK's model-level mirror below, the DB
  # floor itself pinned by the one-scope raise tests at the end).
  describe "the exactly-one scope" do
    let(:plan) { StudyPlan.create!(user: user, topic: "COMP5241 exam prep") }

    it "accepts a plan-scoped thread (plan association resolves to the StudyPlan)" do
      thread = described_class.create!(user: user, plan: plan)

      aggregate_failures do
        expect(thread).to be_valid
        expect(thread.plan).to eq(plan)
        expect(thread.material_id).to be_nil
      end
    end

    it "rejects a thread with both anchors set" do
      thread = described_class.new(user: user, material: material, plan: plan)

      expect(thread).not_to be_valid
      expect(thread.errors[:base]).to include(/exactly one of material_id \/ plan_id/)
    end

    it "rejects a thread with neither anchor set" do
      thread = described_class.new(user: user)

      expect(thread).not_to be_valid
      expect(thread.errors[:base]).to include(/exactly one of material_id \/ plan_id/)
    end

    it "rejects a second thread for the same plan (unique plan_id index, the 1:1 floor)" do
      described_class.create!(user: user, plan: plan)

      expect { described_class.create!(user: user, plan: plan) }
        .to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "enforces the chat_threads_one_scope CHECK at the database (both anchors)" do
      thread = described_class.create!(user: user, material: material)

      expect { thread.update_columns(plan_id: plan.id) }
        .to raise_error(ActiveRecord::StatementInvalid)
    end
  end
end
