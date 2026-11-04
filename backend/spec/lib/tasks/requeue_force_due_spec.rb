# frozen_string_literal: true

require "rails_helper"
require "rake"

# The dev/demo force-due trigger (epic P2-7 ticket 03): flips a user's
# schedules due now so a demo shows the re-queue without waiting days. The
# guard is the point — the task must refuse to exist as a prod surface.
RSpec.describe "requeue:force_due" do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  before do
    Rails.application.load_tasks
    TaskRakeGuardHelpers.reset_rake("requeue:force_due")
  end

  let(:user) { create(:user, email: "demo@example.com") }

  it "flips all of the user's schedules due now" do
    travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
      create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
      create(:flashcard, user: user, difficulty: "easy", updated_at: Time.current)
      Requeue::ScanDueItemsCommand.call
      expect(RequeueSchedule.where(next_due_at: ..Time.current).count).to eq(0)
    end

    travel_to(Time.zone.parse("2026-11-09 09:00:00 UTC")) do
      Rake::Task["requeue:force_due"].invoke("demo@example.com")

      expect(RequeueSchedule.where(next_due_at: ..Time.current).count).to eq(2)
    end
  end

  it "refuses to run in production (dev/demo-only — never prod-exposed)" do
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))

    expect do
      Rake::Task["requeue:force_due"].invoke("demo@example.com")
    end.to raise_error(SystemExit, /dev\/demo-only/)
  end

  it "aborts on an unknown user" do
    expect do
      Rake::Task["requeue:force_due"].invoke("nobody@example.com")
    end.to raise_error(SystemExit, /no user/)
  end
end

# The rake task guard test helper: invoke is once-per-process (the task
# records itself as already-invoked) — reset between examples.
module TaskRakeGuardHelpers
  def self.reset_rake(name)
    task = Rake::Task[name]
    task.reenable
    task
  end
end
