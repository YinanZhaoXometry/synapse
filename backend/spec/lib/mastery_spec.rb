# frozen_string_literal: true

require "rails_helper"
require "json"
require "time"

# The golden-vector suite (epic P2-4 ticket 02, AD-14): the committed fixture
# spec/fixtures/mastery_vectors.json IS the acceptance bar. Every mastery-derived
# number in it is a decimal STRING and every comparison here is exact string
# equality — zero tolerance, no epsilon, no rounding on comparison
# (meta.fixtureEncoding). The TS implementation is the source until the cutover
# retires it; this suite pins the Ruby port to it case for case.
RSpec.describe Mastery do
  VECTORS = JSON.parse(File.read(Rails.root.join("spec/fixtures/mastery_vectors.json"))).freeze
  META = VECTORS.fetch("meta").freeze
  CASES = VECTORS.fetch("cases").freeze

  # The module's record seam: anything responding to #outcome (String/Symbol from
  # the closed ADR-0001 vocabulary) and #created_at (Time). The fixture's JSON
  # shape ("outcome"/"createdAt") maps onto it here — and EvidenceRecord rows fit
  # it verbatim (ticket 03's resolvers pass AR relations straight through).
  FixtureRecord = Struct.new(:id, :node_id, :outcome, :created_at, keyword_init: true)

  # Both ECMAScript Number::toString and Ruby Float#to_s emit the shortest decimal
  # that round-trips the underlying IEEE-754 double — identical digits for
  # identical bits. Their one divergence is the integral case ("1" vs "1.0");
  # normalizing it away makes the comparison below exact-string parity, nothing
  # looser.
  def js_number(value)
    value.to_s.sub(/\.0\z/, "")
  end

  def records(json_records)
    json_records.map do |r|
      FixtureRecord.new(id: r["id"], node_id: r["nodeId"], outcome: r["outcome"], created_at: Time.iso8601(r["createdAt"]))
    end
  end

  describe "meta contract (config parity + encoding)" do
    it "mirrors meta.config verbatim in the module constants (MASTERY_CONFIG parity)" do
      config = META.fetch("config")
      expect(described_class::WINDOW).to eq(config.fetch("window"))
      expect(described_class::EVIDENCE_GATE).to eq(config.fetch("evidenceGate"))
      expect(described_class::MASTERED_THRESHOLD).to eq(config.fetch("masteredThreshold"))
      expect(described_class::OUTCOME_VALUES).to eq(config.fetch("outcomeValues").transform_values { |v| Float(v) })
    end

    it "speaks the TS state vocabulary verbatim — no second vocabulary (AD-6)" do
      expect(described_class::STATES).to eq(%w[uncovered partial mastered])
    end

    it "carries a full-sha provenance pin (generatedAtSourceCommit)" do
      expect(META.fetch("generatedAtSourceCommit")).to match(/\A[0-9a-f]{40}\z/)
    end

    it "consumes the whole matrix — 33 cases across the five categories" do
      counts = CASES.group_by { |c| c["category"] }.transform_values(&:length)
      expect(CASES.length).to eq(33)
      expect(counts).to eq(
        "node_score" => 12,
        "rollup" => 7,
        "task_rollup" => 2,
        "streak" => 10,
        "streak_divergence" => 2,
      )
    end

    it "dispatches every case through one of the four TS calls" do
      expect(CASES.map { |c| c["call"] }.uniq.sort).to eq(
        %w[computeNodeScore computePlanRollup computeStreak computeTaskRollup],
      )
    end
  end

  describe "node_score cases (computeNodeScore — half-up rounding, 99 cap)" do
    CASES.select { |c| c["category"] == "node_score" }.each do |c|
      it c["id"] do
        stats = described_class.node_stats(records(c["input"]["evidence"]))

        expect(stats.score.to_s).to eq(c.dig("expected", "score"))
        expect(stats.state).to eq(c.dig("expected", "state"))
        expected_mean = c.dig("expected", "meanOfWindowedValues")
        if expected_mean.nil?
          expect(stats.mean_of_windowed_values).to be_nil
        else
          # The pre-round intermediate: bit-identical float, compared as the
          # shortest round-trip string (zero tolerance on the digits).
          expect(js_number(stats.mean_of_windowed_values)).to eq(expected_mean)
        end
      end
    end
  end

  describe "rollup cases (computePlanRollup — floored mean, amendment 2026-11-04)" do
    CASES.select { |c| c["category"] == "rollup" }.each do |c|
      it c["id"] do
        by_node = c["input"]["evidenceByNode"].transform_values { |rs| records(rs) }

        expect(described_class.compute_plan_rollup(by_node).to_s).to eq(c.dig("expected", "rollup"))

        actual_nodes = described_class.summarize_nodes(by_node).sort_by(&:node_id)
        expected_nodes = c.dig("expected", "nodes").sort_by { |n| n["nodeId"] }
        expect(actual_nodes.map { |n| [ n.node_id, n.score.to_s, n.state ] })
          .to eq(expected_nodes.map { |n| [ n["nodeId"], n["score"], n["state"] ] })
      end
    end
  end

  describe "task_rollup cases (computeTaskRollup — the single node's score)" do
    CASES.select { |c| c["category"] == "task_rollup" }.each do |c|
      it c["id"] do
        rollup = described_class.compute_task_rollup(records(c["input"]["evidence"]))

        expect(rollup.to_s).to eq(c.dig("expected", "rollup"))
      end
    end
  end

  describe "streak cases (computeStreak — the pinned UTC contract)" do
    # The fixture's local-boundary cases were generated with the runtime TZ pinned
    # to fixed simulated zones (meta.streak.localModeVectors). The api module is
    # UTC-only by contract (ADR-0001, amended 2026-11-04 — a server cannot know a
    # browser's local time), so the spec reproduces each simulation arithmetically:
    # under a fixed offset, a local calendar day IS the UTC day of instant+offset.
    # A local case missing from this table fails loudly (KeyError) instead of
    # silently degrading to the UTC answer.
    LOCAL_CASE_OFFSET_HOURS = {
      "streak.local.simulated-utc.consecutive-days-alive" => 0,
      "streak.local.simulated-utc.two-day-gap-broken" => 0,
      "streak.divergence.local-mode-simulated-asia-shanghai-one-day" => 8
    }.freeze

    def run_streak_case(c)
      now = Time.iso8601(c["input"]["now"])
      case_records = records(c["input"]["evidence"])
      if c["input"]["dayBoundary"] == "local"
        shift = LOCAL_CASE_OFFSET_HOURS.fetch(c["id"]) * 3600
        case_records = case_records.map do |r|
          FixtureRecord.new(id: r.id, node_id: r.node_id, outcome: r.outcome, created_at: r.created_at + shift)
        end
        now += shift
      end
      described_class.compute_streak(case_records, now: now)
    end

    (CASES.select { |c| %w[streak streak_divergence].include?(c["category"]) }).each do |c|
      it c["id"] do
        expect(run_streak_case(c).to_s).to eq(c.dig("expected", "streak"))
      end
    end

    it "refuses any day boundary other than the pinned UTC one" do
      expect { described_class.compute_streak([], now: Time.at(0), day_boundary: :local) }
        .to raise_error(ArgumentError, /UTC/)
    end
  end
end
