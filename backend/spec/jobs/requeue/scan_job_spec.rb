# frozen_string_literal: true

require "rails_helper"

RSpec.describe Requeue::ScanJob do
  # Direct job testing (AD-10): the recurring wake is a thin wrapper (AD-12)
  # — this pins exactly that thinness plus the failure-observability seam
  # (review round 1: a command Failure VALUE must not masquerade as a
  # successful run). The supervisor never boots under rspec (test env keeps
  # its own adapter; puma.rb is never loaded); the supervisor's boot is
  # proven in the dev compose, and the recurring config shape is pinned by
  # spec/config/recurring_schedule_spec.rb.
  it "calls the scan command exactly once per wake and hands back its result" do
    allow(Requeue::ScanDueItemsCommand).to receive(:call).and_call_original

    result = described_class.perform_now

    expect(result).to be_success
    expect(Requeue::ScanDueItemsCommand).to have_received(:call).exactly(:once)
  end

  it "raises on a command Failure (a failed wake must surface in Solid Queue + logs, not masquerade as success)" do
    # The real failure path: the command returns the dry-monads Failure
    # wrapping the typed struct (what ApplicationCommand builds).
    failure = Dry::Monads::Failure.new(
      ApplicationErrors::Failure.new(code: :INTERNAL, context: { message: "the scan broke" })
    )
    allow(Requeue::ScanDueItemsCommand).to receive(:call).and_return(failure)
    allow(Rails.logger).to receive(:error)

    expect do
      described_class.perform_now
    end.to raise_error(/re-queue scan failed: INTERNAL the scan broke/)

    expect(Rails.logger).to have_received(:error).with(/re-queue scan failed: INTERNAL/)
  end

  it "does not retry mid-scan failures (the next wake recomputes everything — correct-on-wake)" do
    expect(described_class.retry_on).to be_blank
  end

  it "runs with solid_queue NOT selected in this environment (the supervisor must never boot here)" do
    # test.rb never opts into :solid_queue (development/production do). The
    # second gate — SOLID_QUEUE_IN_PUMA on the puma plugin — is inert here by
    # construction: rspec never loads config/puma.rb, so even a `run`
    # container inheriting the env (compose sets it at service level) cannot
    # boot the supervisor.
    expect(Rails.application.config.active_job.queue_adapter).not_to eq(:solid_queue)
  end
end
