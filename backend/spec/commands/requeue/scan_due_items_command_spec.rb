# frozen_string_literal: true

require "rails_helper"

RSpec.describe Requeue::ScanDueItemsCommand do
  # Ticket-01 shape: the recurring shape exists, the algorithm is ticket 02's
  # (kickoff decision 6). This stub spec is the seam the ticket-02 Timecop
  # suite replaces; the job-side thinness is pinned by
  # spec/jobs/requeue/scan_job_spec.rb.
  it "succeeds with an empty due set (the ticket-02 algorithm replaces this body)" do
    result = described_class.call

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:due_count]).to eq(0)
      expect(result.value![:scanned_at]).to be_within(5.seconds).of(Time.current)
    end
  end

  it "is user-less — a system-shaped command (the wake serves every user; default authorize stands)" do
    # No current_user option exists; the command must not require one.
    expect(described_class.call.success?).to be(true)
  end
end
