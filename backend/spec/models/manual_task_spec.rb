# frozen_string_literal: true

require "rails_helper"

RSpec.describe ManualTask do
  # User scoping is pinned by the shared context (spec/models/
  # user_scoping_spec.rb discovers this model automatically via
  # belongs_to :user + the User has_many + the factory).
  include_examples "user-scoped", described_class

  it "defaults done to false and tolerates a null due date (the unscheduled 'someday' task)" do
    task = create(:manual_task, due_date: nil)

    aggregate_failures do
      expect(task.done).to be(false)
      expect(task.due_date).to be_nil
      expect(task.title).to be_present
    end
  end

  it "keeps the weekly goal target on the user row with the delta default" do
    user = create(:user)

    aggregate_failures do
      expect(user.weekly_goal_target).to eq(3)
      user.update!(weekly_goal_target: 21)
      expect(user.reload.weekly_goal_target).to eq(21)
    end
  end

  it "rejects a weekly goal target outside 1..21 at the database floor" do
    user = create(:user)

    expect do
      user.update_column(:weekly_goal_target, 22) # rubocop:disable Rails/SkipsModelValidations — the DB floor is the subject
    end.to raise_error(ActiveRecord::StatementInvalid)
  end
end
