# frozen_string_literal: true

require "rails_helper"

RSpec.describe Requeue::ScanJob do
  # Direct job testing (AD-10): the recurring wake is a thin wrapper (AD-12)
  # — this pins exactly that thinness. The supervisor never boots under
  # rspec (test env keeps the :test adapter; SOLID_QUEUE_IN_PUMA unset); the
  # supervisor's own boot is proven in the dev compose, and the recurring
  # config shape is pinned by spec/config/recurring_schedule_spec.rb.
  it "calls the scan command exactly once per wake and hands back its result" do
    allow(Requeue::ScanDueItemsCommand).to receive(:call).and_call_original

    result = described_class.perform_now

    expect(result).to be_success
    expect(Requeue::ScanDueItemsCommand).to have_received(:call).exactly(:once)
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
