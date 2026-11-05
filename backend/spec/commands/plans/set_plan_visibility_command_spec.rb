# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::SetPlanVisibilityCommand do
  # The FR-38 visibility flip (epic P2-11 T1): the plan settings surface's
  # write. Closed-enum validation (VALIDATION_FAILED), the house NOT_FOUND
  # matrix (unknown / foreign / malformed ids — AD-13), and idempotent by
  # law: setting the visibility the row already carries returns the row
  # UNCHANGED — no write, updated_at untouched (no phantom activity on a
  # double-tap or an offline replay; the manual-task done-toggle precedent).

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user, topic: "复习计划") }

  def call(id, visibility)
    described_class.call(current_user: user, id: id, visibility: visibility)
  end

  it "flips a private plan to public" do
    result = call(plan.id, "public")

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:plan].id).to eq(plan.id)
      expect(plan.reload.visibility).to eq("public")
    end
  end

  it "flips a public plan back to private" do
    plan.update!(visibility: "public")

    result = call(plan.id, "private")

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(plan.reload.visibility).to eq("private")
    end
  end

  it "is idempotent: setting the carried visibility returns the row with updated_at untouched" do
    plan.update!(visibility: "public")
    before_updated_at = plan.reload.updated_at

    result = call(plan.id, "public") # the row already reads public

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:plan].id).to eq(plan.id)
      expect(plan.reload.updated_at).to eq(before_updated_at)
      expect(plan.visibility).to eq("public")
    end
  end

  it "answers NOT_FOUND for an unknown id" do
    result = call(SecureRandom.uuid, "public")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "answers NOT_FOUND for a foreign id (another user's plan — never linked, AD-13)" do
    other_plan = create(:study_plan)

    result = call(other_plan.id, "public")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
    expect(other_plan.reload.visibility).to eq("private")
  end

  it "answers NOT_FOUND for a malformed (non-uuid) id" do
    result = call("../../etc/passwd", "public")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "refuses a visibility outside the closed enum with VALIDATION_FAILED" do
    result = call(plan.id, "unlisted")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:visibility)
    end
    expect(plan.reload.visibility).to eq("private")
  end
end
