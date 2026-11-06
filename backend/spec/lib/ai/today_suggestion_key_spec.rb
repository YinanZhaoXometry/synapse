# frozen_string_literal: true

require "rails_helper"

# Ai::TodaySuggestionKey (epic-18 T2, spec decision 9): the Today
# suggestion's deterministic per-(user, plan, UTC day) replay key. The
# derivation is a CROSS-STACK PIN — ticket 04's frontend mirrors it
# byte-for-byte — so the exact output is pinned here against literal test
# vectors, and the vectors were independently verified against Python's
# RFC-4122 uuid.uuid5 (namespace UUID + name) before being committed.
RSpec.describe Ai::TodaySuggestionKey do
  let(:user_id) { "3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f" }
  let(:plan_id) { "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" }
  let(:now) { Time.zone.parse("2026-11-06 09:30:00 UTC") }

  describe ".derive" do
    it "pins the EXACT derivation: uuid5(namespace = user uuid, name = \"<planId>:<UTC day>\")" do
      expect(described_class.derive(user_id: user_id, plan_id: plan_id, now: now))
        .to eq("8205dada-5e78-5321-8371-91366687a3d7")
    end

    it "pins a second exact vector (the shape must hold across inputs, not fit one)" do
      expect(described_class.derive(user_id: "11111111-2222-4333-8444-555555555555",
                                    plan_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                                    now: Time.zone.parse("2026-01-02 00:00:00 UTC")))
        .to eq("3cb8e048-55b8-5299-8770-3d465dbb5107")
    end

    it "is deterministic: the same (user, plan, UTC day) always derives the same uuid" do
      first = described_class.derive(user_id: user_id, plan_id: plan_id, now: now)
      second = described_class.derive(user_id: user_id, plan_id: plan_id,
                                      now: now + 14.hours) # same UTC day, later hour

      expect(second).to eq(first)
    end

    it "changes with the UTC day (a new day spends again — spec decision 9)" do
      same_day_edge = described_class.derive(user_id: user_id, plan_id: plan_id,
                                             now: Time.zone.parse("2026-11-06 23:59:59 UTC"))
      next_day = described_class.derive(user_id: user_id, plan_id: plan_id,
                                        now: Time.zone.parse("2026-11-07 00:00:00 UTC"))

      expect(next_day).not_to eq(same_day_edge)
    end

    it "keeps the day on the UTC boundary (the streak's midnight-UTC convention)" do
      # 2026-11-06 23:59:59 UTC and 2026-11-07 00:00:01 UTC are adjacent
      # seconds in absolute time but DIFFERENT derivation days.
      late = described_class.derive(user_id: user_id, plan_id: plan_id,
                                    now: Time.zone.parse("2026-11-06 23:59:59 UTC"))
      early = described_class.derive(user_id: user_id, plan_id: plan_id,
                                     now: Time.zone.parse("2026-11-07 00:00:01 UTC"))

      expect(early).not_to eq(late)
    end

    it "is user-scoped: a different user derives a different uuid for the same plan+day" do
      other = described_class.derive(user_id: "11111111-2222-4333-8444-555555555555",
                                     plan_id: plan_id, now: now)

      expect(other).not_to eq(described_class.derive(user_id: user_id, plan_id: plan_id, now: now))
    end

    it "is plan-scoped: a different plan derives a different uuid for the same user+day" do
      other = described_class.derive(user_id: user_id, plan_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", now: now)

      expect(other).not_to eq(described_class.derive(user_id: user_id, plan_id: plan_id, now: now))
    end
  end

  describe ".uuid5 (the RFC-4122 §4.3 primitive)" do
    it "always emits version 5 and the RFC variant bits" do
      20.times do |i|
        uuid = described_class.uuid5(namespace: "3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f",
                                     name: "probe-#{i}")
        aggregate_failures do
          expect(uuid).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/)
        end
      end
    end

    it "is lowercase and dash-grouped 8-4-4-4-12 (the uuid shape the command's replay lookup keys on)" do
      uuid = described_class.uuid5(namespace: user_id, name: "shape-probe")

      expect(uuid).to eq(uuid.downcase)
      expect(uuid.length).to eq(36)
      expect(uuid.split("-").map(&:length)).to eq([ 8, 4, 4, 4, 12 ])
    end
  end
end
