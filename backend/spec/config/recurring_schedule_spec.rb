# frozen_string_literal: true

require "rails_helper"
require "yaml"

# The recurring schedule shape (AD-19, epic P2-7 ticket 01): ONE named
# recurring job — the FR-24 due scan (kickoff decision 5). This pins the
# config as the source of truth the in-process supervisor reads, and keeps
# unnamed background work out (the upstream finished-jobs cleanup default
# was deliberately dropped — its absence is asserted too).
RSpec.describe "the Solid Queue recurring schedule" do
  let(:config) do
    ActiveSupport::ConfigurationFile.parse(Rails.root.join("config/recurring.yml"))
  end

  it "registers exactly the due_scan task in every environment that boots the supervisor" do
    %w[development production].each do |env|
      tasks = config.fetch(env)

      aggregate_failures do
        expect(tasks.keys).to eq([ "due_scan" ])
        expect(tasks["due_scan"]["class"]).to eq("Requeue::ScanJob")
        expect(tasks["due_scan"]["schedule"]).to eq("every 10 minutes")
      end
    end
  end

  it "keeps the entry resolvable by fugit (the gem parses these schedules)" do
    require "fugit"

    expect(Fugit::Nat.parse(config.fetch("production")["due_scan"]["schedule"])).to be_present
  end

  it "schedules the scan through the thin job (which owns no decisions)" do
    expect(config.fetch("production")["due_scan"]["class"].constantize).to eq(Requeue::ScanJob)
  end
end
