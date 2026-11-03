# frozen_string_literal: true

require "date"

# Mastery Score — the api's ONE scoring implementation (AD-6), a verbatim Ruby
# port of the TS source of truth (frontend/src/domain/mastery.ts + streak.ts in
# UTC mode) per AD-14. Contract: ADR-0001 (amendment history in the ADR itself),
# pinned case-for-case by the golden vectors in spec/fixtures/mastery_vectors.json
# — spec/lib/mastery_spec.rb consumes the whole matrix with exact string-decimal
# equality (zero tolerance). Until the cutover retires the TS side, no scoring
# logic may live anywhere else in the api (backend/AGENTS.md).
#
# Rounding postures (ADR-0001, amended 2026-11-04):
#   - node score: Math.round semantics — half toward +infinity (37.5 → 38)
#   - plan rollup: Math.floor semantics — a tie rounds DOWN (99.5 → 99), which is
#     what makes 100 arithmetically reachable only when every node scores 100
#   - streak: UTC calendar days only — a server cannot know a browser's local time
#
# The record seam is deliberately duck-typed so the golden-vector spec and the
# eventual GraphQL resolvers (ticket 03) share it verbatim: an Enumerable of
# objects responding to #outcome (String/Symbol from the closed { correct,
# partial, wrong } vocabulary — EvidenceRecord's enum qualifies) and #created_at
# (a Time). Everything is pure: no I/O, no clock, the streak's "now" is injected.
module Mastery
  # Mirrors MASTERY_CONFIG (frontend/src/domain/mastery.ts) value for value —
  # the fixture's meta.config pins this equality in spec/lib/mastery_spec.rb.
  WINDOW = 5
  OUTCOME_VALUES = { "correct" => 1.0, "partial" => 0.5, "wrong" => 0.0 }.freeze
  MASTERED_THRESHOLD = 80
  EVIDENCE_GATE = 3

  # ADR-0001 amendment 2026-11-02: below the evidence gate a node's score caps
  # here — 100 anywhere must mean verified mastery.
  UNVERIFIED_CAP = 99

  # The TS state vocabulary verbatim (AD-6: no second vocabulary).
  STATES = [ "uncovered", "partial", "mastered" ].freeze

  # One node's scoring outcome: the displayed score, its state, and the pre-round
  # windowed mean. The mean is part of the golden-vector contract (float parity
  # with the TS intermediate); scoring surfaces only need score and state.
  NodeStats = Struct.new(:score, :state, :mean_of_windowed_values, keyword_init: true)

  # Per-node surface contract (the plan rollup's node rows).
  NodeSummary = Struct.new(:node_id, :score, :state, keyword_init: true)

  class << self
    # round(100 × mean of the node's last WINDOW outcomes); 0 with no evidence.
    # Below EVIDENCE_GATE the score caps at UNVERIFIED_CAP (ADR-0001 amendment
    # 2026-11-02: the gate caps the SCORE, not only the state).
    def node_stats(records)
      records = records.to_a
      return NodeStats.new(score: 0, state: "uncovered", mean_of_windowed_values: nil) if records.empty?

      values = recent_first(records).first(WINDOW).map { |r| OUTCOME_VALUES.fetch(r.outcome.to_s) }
      # Naive left-to-right summation — ECMAScript reduce's order, NOT
      # Array#sum's compensated one; the float path must be bit-identical
      # to the TS source (the outcome values are exact halves, so both agree
      # here, but the port pins the order anyway).
      mean = values.inject(0.0) { |sum, v| sum + v } / values.length
      raw = (100 * mean).round # Math.round semantics: ties toward +∞ for these non-negative values
      score = records.length >= EVIDENCE_GATE ? raw : [ raw, UNVERIFIED_CAP ].min

      NodeStats.new(score: score, state: state_for(records, score), mean_of_windowed_values: mean)
    end

    # The node's displayed score (0..100).
    def compute_node_score(records)
      node_stats(records).score
    end

    # "uncovered" (no evidence) / "partial" / "mastered" (score ≥ threshold AND
    # ≥ EVIDENCE_GATE total records — the anti-inflation gate, SM-C2).
    def node_state(records)
      node_stats(records).state
    end

    # Per-node summaries in the hash's key order (the rollup's node rows).
    def summarize_nodes(evidence_by_node)
      evidence_by_node.map do |node_id, records|
        stats = node_stats(records)
        NodeSummary.new(node_id: node_id, score: stats.score, state: stats.state)
      end
    end

    # Plan rollup (AD-6): mean of node scores with uncovered nodes counting 0,
    # FLOORED once to the whole percent (ADR-0001 amendment 2026-11-04). Floor —
    # not half-up — is what restores the readiness invariant: (n·100−1)/n is
    # strictly below 100 for every n, so the rollup reads 100 only when every
    # node scores 100, and a node scores 100 only past the evidence gate — i.e.
    # rollup 100 ⇔ every node mastered. Integer operands keep this exact (the
    # TS Math.floor(total / count) is identical at any realistic plan size).
    def compute_plan_rollup(evidence_by_node)
      summaries = summarize_nodes(evidence_by_node)
      return 0 if summaries.empty?

      total = summaries.sum(&:score)
      (total.to_f / summaries.length).floor
    end

    # Study Task rollup (AD-6): exactly its single owned node's score — no other
    # rollup exists.
    def compute_task_rollup(records)
      node_stats(records).score
    end

    # Evidence-day streak (FR-25 / SM-C3): consecutive UTC calendar days with at
    # least one EvidenceRecord, ending at the latest evidence day; alive while
    # that day is today or yesterday, otherwise broken → 0. The boundary is UTC
    # by contract (ADR-0001, amended 2026-11-04) and nothing else is accepted —
    # a per-user timezone stays a deferred row. "now" is injected; pure.
    def compute_streak(records, now:, day_boundary: :utc)
      unless day_boundary == :utc
        raise ArgumentError,
              "the api's pinned streak boundary is UTC (ADR-0001, amended 2026-11-04); got #{day_boundary.inspect}"
      end

      records = records.to_a
      return 0 if records.empty?

      evidence_days = records.map { |r| utc_day_key(r.created_at) }.uniq
      latest = evidence_days.max # "YYYY-MM-DD" strings sort chronologically
      return 0 if day_distance(latest, utc_day_key(now)) > 1 # last evidence before yesterday

      streak = 1
      cursor = latest
      while evidence_days.include?(previous_day(cursor))
        cursor = previous_day(cursor)
        streak += 1
      end
      streak
    end

    private

    # Newest first by createdAt — the window is over recency, not insertion
    # order. Ties keep insertion order (the sane stable-sort reading of the TS
    # comparator; the golden vectors hold no ties to distinguish further).
    def recent_first(records)
      records.each_with_index.sort do |(a, ai), (b, bi)|
        if a.created_at == b.created_at
          ai <=> bi
        else
          b.created_at <=> a.created_at
        end
      end.map(&:first)
    end

    def state_for(records, score)
      if score >= MASTERED_THRESHOLD && records.length >= EVIDENCE_GATE
        "mastered"
      else
        "partial"
      end
    end

    def utc_day_key(time)
      time.utc.strftime("%Y-%m-%d")
    end

    def day_distance(from_key, to_key)
      (Date.iso8601(to_key) - Date.iso8601(from_key)).to_i
    end

    def previous_day(key)
      Date.iso8601(key).prev_day.strftime("%Y-%m-%d")
    end
  end
end
