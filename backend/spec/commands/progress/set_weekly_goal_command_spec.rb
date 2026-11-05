# frozen_string_literal: true

require "rails_helper"

RSpec.describe Progress::SetWeeklyGoalCommand do
  # The weekly goal setter (epic P2-09 T1, delta decision 3): a plain setter
  # on users.weekly_goal_target — the range 1..21 validated server-side (the
  # DB check floor is the second pin); the last write wins (no replay
  # semantics — it is not an idempotent create).

  let(:user) { create(:user) }

  def call(target)
    described_class.call(current_user: user, target: target)
  end

  it "persists the target and returns the fresh weekly-goal read" do
    result = call(5)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:weekly_goal].target).to eq(5)
      expect(user.reload.weekly_goal_target).to eq(5)
    end
  end

  it "accepts the range edges (1 and 21)" do
    aggregate_failures do
      expect(call(1).success?).to be(true)
      expect(call(21).success?).to be(true)
      expect(user.reload.weekly_goal_target).to eq(21)
    end
  end

  it "refuses targets outside the range with VALIDATION_FAILED, persisting nothing" do
    aggregate_failures do
      [ 0, -1, 22, 100 ].each do |target|
        result = call(target)
        expect(result.success?).to be(false)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:target)
      end
    end
    expect(user.reload.weekly_goal_target).to eq(3) # the delta default, untouched
  end

  it "refuses a non-integer target with VALIDATION_FAILED" do
    result = call("5")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end
  end
end
