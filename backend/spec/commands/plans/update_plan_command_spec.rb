# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::UpdatePlanCommand do
  # Direct command testing (AD-10). The patch hash carries only the fields
  # the caller actually provided (the mutation distinguishes "absent" from
  # "explicit null" at the GraphQL boundary) — an explicit nil goal clears it.

  let(:user) { create(:user) }
  let!(:plan) { create(:study_plan, user: user, topic: "old topic", goal: "old goal") }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      id: plan.id,
      patch: { topic: "new topic" },
      **overrides
    )
  end

  describe ".call" do
    it "applies the provided patch and returns the updated plan" do
      result = call

      expect(result.success?).to be(true)
      expect(result.value![:plan].topic).to eq("new topic")
      expect(result.value![:plan].goal).to eq("old goal")
      expect(plan.reload.topic).to eq("new topic")
    end

    it "clears the goal with an explicit nil (Phase-1 patch semantics)" do
      result = call(patch: { goal: nil })

      expect(result.success?).to be(true)
      expect(result.value![:plan].goal).to be_nil
    end

    it "updates visibility passthrough" do
      result = call(patch: { visibility: "public" })

      expect(result.value![:plan].visibility).to eq("public")
    end

    it "fails NOT_FOUND for another user's plan id (uniform NOT_FOUND, delta 2)" do
      other = create(:user)

      result = described_class.call(current_user: other, id: plan.id, patch: { topic: "hijack" })

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(plan.reload.topic).to eq("old topic")
    end

    it "fails NOT_FOUND for an unknown id" do
      result = call(id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "fails VALIDATION_FAILED for a blank topic patch" do
      result = call(patch: { topic: "  " })

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(plan.reload.topic).to eq("old topic")
    end

    it "fails VALIDATION_FAILED for a visibility outside the enum" do
      result = call(patch: { visibility: "unlisted" })

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "succeeds with an empty patch (no-op update)" do
      result = call(patch: {})

      expect(result.success?).to be(true)
      expect(result.value![:plan].topic).to eq("old topic")
    end
  end
end
