# frozen_string_literal: true

require "rails_helper"

# Ai::Targeting (FR-21, epic P2-10 T5): the pure weak-spot quota math. The
# delta-grill's recorded weights (epic.md decision 2, BINDING): per-node
# weight w = 1 + (100 − masteryScore)/50 (+1.0 flat bonus on ≥ 1 mistake
# entry), capped at 4.0; allocation across candidate nodes by largest
# remainder, tie-break node order then id, quotas sum EXACTLY to the total.
# Pure module — no I/O, no clock; the score arrives in the wire's String!
# percent form ("0".."100"; uncovered/no-evidence → "0", anything unparsable
# reads 0 too).
RSpec.describe Ai::Targeting do
  def candidate(id, score: "100", mistakes: 0)
    described_class::Candidate.new(id: id, score: score, mistakes: mistakes)
  end

  describe ".weight (the recorded delta-grill weights)" do
    it "maps the score percent 100 → 1.0, 50 → 2.0, 0 → 3.0" do
      aggregate_failures do
        expect(described_class.weight(score: "100", mistakes: 0)).to eq(1.0)
        expect(described_class.weight(score: "50", mistakes: 0)).to eq(2.0)
        expect(described_class.weight(score: "0", mistakes: 0)).to eq(3.0)
      end
    end

    it "reads an unparsable/absent score as 0 (uncovered/no-evidence → score 0)" do
      aggregate_failures do
        expect(described_class.weight(score: nil, mistakes: 0)).to eq(3.0)
        expect(described_class.weight(score: "", mistakes: 0)).to eq(3.0)
        expect(described_class.weight(score: "not-a-score", mistakes: 0)).to eq(3.0)
      end
    end

    it "adds the flat +1.0 bonus when the node has at least one mistake entry" do
      aggregate_failures do
        expect(described_class.weight(score: "100", mistakes: 0)).to eq(1.0)
        expect(described_class.weight(score: "100", mistakes: 1)).to eq(2.0)
        expect(described_class.weight(score: "100", mistakes: 7)).to eq(2.0) # flat — not per-mistake
      end
    end

    it "caps the total weight at 4.0" do
      # 3.0 (score 0) + 1.0 (bonus) = 4.0 exactly; more mistakes cannot push
      # past it. The cap only engages there: any higher score keeps the sum
      # strictly under 4.0 (score 25 → 2.5 + 1.0 = 3.5, uncapped).
      expect(described_class.weight(score: "0", mistakes: 1)).to eq(4.0)
      expect(described_class.weight(score: "0", mistakes: 12)).to eq(4.0)
      expect(described_class.weight(score: "25", mistakes: 5)).to eq(3.5)
    end

    it "accepts an Integer score too (the caller's convenience form)" do
      expect(described_class.weight(score: 80, mistakes: 0)).to eq(1.4)
    end
  end

  describe ".allocate (largest-remainder quotas)" do
    it "splits the total in exact weight proportion when it divides evenly" do
      # weights 1.0 / 3.0 / 1.0 (scores 100 / 0 / 100) over 5 questions → 1 / 3 / 1
      quotas = described_class.allocate(
        candidates: [ candidate("a", score: "100"), candidate("b", score: "0"), candidate("c", score: "100") ],
        total: 5
      )
      expect(quotas).to eq("a" => 1, "b" => 3, "c" => 1)
    end

    it "distributes the remainder to the largest fractional part" do
      # weights 4.0 / 1.0 over 4 → exact 3.2 / 0.8 → floors 3 / 0 → leftover 1
      # → the 0.8 remainder (the LOW-weight node) receives it → 3 / 1.
      quotas = described_class.allocate(
        candidates: [ candidate("strong", score: "0", mistakes: 1), candidate("weak", score: "100") ],
        total: 4
      )
      expect(quotas).to eq("strong" => 3, "weak" => 1)
    end

    it "breaks remainder ties by node order (input order), never arbitrarily" do
      # equal weights 1.0/1.0/3.0 over 4 → exact 0.8/0.8/2.4 → floors 0/0/2 →
      # leftover 2 → the two 0.8 remainders tie → input order → a then b.
      quotas = described_class.allocate(
        candidates: [ candidate("a"), candidate("b"), candidate("c", score: "0") ],
        total: 4
      )
      expect(quotas).to eq("a" => 1, "b" => 1, "c" => 2)
    end

    it "breaks remainder ties between equal weights by input order regardless of id text" do
      # Same remainder everywhere; the FIRST candidate in node order wins the
      # extra seat even when its id sorts later.
      quotas = described_class.allocate(
        candidates: [ candidate("zzz-late"), candidate("aaa-early") ],
        total: 1
      )
      expect(quotas).to eq("zzz-late" => 1, "aaa-early" => 0)
    end

    it "sums EXACTLY to the total on a distribution with messy fractions" do
      # weights 1.4 / 2.98 / 3.98 (scores 80 / 1 / 1+bonus) over 7 — the
      # fractional seats cannot drift: the quotas must total 7 exactly.
      quotas = described_class.allocate(
        candidates: [
          candidate("a", score: "80"),
          candidate("b", score: "1"),
          candidate("c", score: "1", mistakes: 1)
        ],
        total: 7
      )
      expect(quotas.values.sum).to eq(7)
      quotas.values.each { |quota| expect(quota).to be >= 0 }
    end

    it "never returns a negative quota and keeps every candidate present (zero included)" do
      # One dominant weight over many candidates and a tight total: the weak
      # candidates stay at 0 — present, never negative, never dropped.
      quotas = described_class.allocate(
        candidates: [
          candidate("dominant", score: "0", mistakes: 1),
          candidate("n1"), candidate("n2"), candidate("n3"), candidate("n4")
        ],
        total: 2
      )
      expect(quotas.keys).to contain_exactly("dominant", "n1", "n2", "n3", "n4")
      expect(quotas.values.sum).to eq(2)
      expect(quotas.values).to all(be >= 0)
    end

    it "guarantees min coverage: total ≥ candidate count → at least one node carries a question" do
      quotas = described_class.allocate(
        candidates: [ candidate("a", score: "0", mistakes: 1), candidate("b"), candidate("c") ],
        total: 3
      )
      expect(quotas.values.sum).to eq(3)
      expect(quotas.values.max).to be >= 1
    end

    it "returns all-zero quotas for a zero total" do
      quotas = described_class.allocate(candidates: [ candidate("a"), candidate("b", score: "0") ], total: 0)
      expect(quotas).to eq("a" => 0, "b" => 0)
    end

    it "returns an empty allocation with no candidates" do
      expect(described_class.allocate(candidates: [], total: 5)).to eq({})
    end

    it "is deterministic: the same input always yields the same quotas" do
      candidates = [ candidate("a", score: "30", mistakes: 1), candidate("b", score: "60"), candidate("c", score: "0") ]
      first = described_class.allocate(candidates: candidates, total: 9)
      second = described_class.allocate(candidates: candidates.map(&:dup), total: 9)
      expect(second).to eq(first)
    end
  end
end
