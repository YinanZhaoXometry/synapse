# frozen_string_literal: true

require "rails_helper"

# Ai::DailyCap (ticket 02, FR-34): 50 calls/user/UTC-day, atomic
# check-and-increment, the 50th admitted and the 51st refused. A1's shape:
# api-local table, same Postgres, midnight-UTC day boundary.
RSpec.describe Ai::DailyCap do
  around do |example|
    original = ENV["AI_DAILY_CALL_CAP"]
    example.run
  ensure
    original.nil? ? ENV.delete("AI_DAILY_CALL_CAP") : ENV["AI_DAILY_CALL_CAP"] = original
  end

  describe ".limit" do
    it "defaults to 50 and falls back on garbage ENV" do
      ENV.delete("AI_DAILY_CALL_CAP")
      expect(described_class.limit).to eq(50)
      ENV["AI_DAILY_CALL_CAP"] = "garbage"
      expect(described_class.limit).to eq(50)
      ENV["AI_DAILY_CALL_CAP"] = "20"
      expect(described_class.limit).to eq(20)
    end
  end

  describe ".consume!" do
    it "counts 1, 2, 3… for the same user on the same UTC day" do
      user = create(:user)
      expect(described_class.consume!(user)).to eq(1)
      expect(described_class.consume!(user)).to eq(2)
      expect(described_class.consume!(user)).to eq(3)
      expect(user.ai_usage_counters.count).to eq(1) # one row per user-day
    end

    it "counts users independently" do
      alice = create(:user)
      bob = create(:user)
      expect(described_class.consume!(alice)).to eq(1)
      expect(described_class.consume!(bob)).to eq(1)
      expect(described_class.consume!(alice)).to eq(2)
    end

    it "starts a fresh count at the UTC day boundary" do
      user = create(:user)
      late_nov_4 = Time.utc(2026, 11, 4, 23, 30)
      early_nov_5 = Time.utc(2026, 11, 5, 0, 30)

      expect(described_class.consume!(user, now: late_nov_4)).to eq(1)
      expect(described_class.consume!(user, now: late_nov_4)).to eq(2)
      expect(described_class.consume!(user, now: early_nov_5)).to eq(1)
      expect(user.ai_usage_counters.order(:day).pluck(:day)).to eq(
        [ Date.new(2026, 11, 4), Date.new(2026, 11, 5) ]
      )
    end

    # The atomicity proof (epic P2-3's lesson: races are spec blind spots).
    # Runs OUTSIDE the wrapping transaction — threads get their own DB
    # connections and cannot see uncommitted rows — so it cleans up after
    # itself. 4 threads: the test pool is 5 connections and the main thread
    # holds one.
    it "is race-safe under concurrent consume! calls (never loses an increment)",
       use_transactional_fixtures: false do
      user = create(:user)
      @user_id = user.id

      threads = Array.new(4) { Thread.new { described_class.consume!(user) } }
      threads.each(&:join)

      expect(user.ai_usage_counters.sole.call_count).to eq(4)
    ensure
      AiUsageCounter.where(user_id: @user_id).delete_all
      User.where(id: @user_id).delete_all
    end
  end

  describe ".tripped?" do
    it "admits count == limit and refuses count > limit" do
      expect(described_class.tripped?(49)).to be(false)
      expect(described_class.tripped?(50)).to be(false)
      expect(described_class.tripped?(51)).to be(true)
    end
  end

  # The read half (epic-14 T1, FR-34's display consequence): today's count +
  # the limit ride the aiUsageToday query — the counter is server truth, read
  # through the same seam that enforces it.
  describe ".count_for" do
    it "answers 0 for a user who has not spent any call today" do
      expect(described_class.count_for(create(:user))).to eq(0)
    end

    it "reflects the recorded consume! count" do
      user = create(:user)
      described_class.consume!(user)
      described_class.consume!(user)

      expect(described_class.count_for(user)).to eq(2)
    end

    it "is scoped per user and per UTC day (the counter row's own key)" do
      alice = create(:user)
      bob = create(:user)
      late_nov_4 = Time.utc(2026, 11, 4, 23, 30)
      early_nov_5 = Time.utc(2026, 11, 5, 0, 30)
      described_class.consume!(alice, now: late_nov_4)
      described_class.consume!(alice, now: late_nov_4)
      described_class.consume!(bob, now: late_nov_4)

      aggregate_failures do
        expect(described_class.count_for(alice, now: late_nov_4)).to eq(2)
        expect(described_class.count_for(bob, now: late_nov_4)).to eq(1)
        # A new UTC day starts at zero — yesterday's spend does not leak.
        expect(described_class.count_for(alice, now: early_nov_5)).to eq(0)
      end
    end
  end
end
