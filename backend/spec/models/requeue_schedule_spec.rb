# frozen_string_literal: true

require "rails_helper"

RSpec.describe RequeueSchedule do
  # User scoping is pinned by the shared context (spec/models/
  # user_scoping_spec.rb discovers this model automatically via
  # belongs_to :user + the User has_many + the factory).
  it "survives its source row being destroyed (schedulable is optional — the scan prunes on the next wake)" do
    schedule = create(:requeue_schedule)

    schedule.schedulable.destroy!

    expect(schedule.reload.schedulable).to be_nil
    expect(schedule).to be_persisted
  end
end
