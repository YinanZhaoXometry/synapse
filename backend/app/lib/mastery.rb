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
# Freshness (ADR-0001, amended 2026-11-04, ticket 04): a node whose LATEST
# evidence record is strictly more than FRESHNESS_DAYS old caps at
# UNVERIFIED_CAP and never reads mastered — but only where the caller injects
# `now` (the score resolvers always do, Time.current). nil `now` keeps the
# identical Phase-1 read; the streak has no freshness rule at all.
#
# The record seam is deliberately duck-typed so the golden-vector spec and the
# GraphQL resolvers share it verbatim: an Enumerable of objects responding to
# #outcome (String/Symbol from the closed { correct, partial, wrong } vocabulary
# — EvidenceRecord's enum qualifies) and #created_at (a Time). Everything is
# pure: no I/O, no clock — both the streak's and the freshness check's "now" are
# injected.
module Mastery
  # Mirrors MASTERY_CONFIG (frontend/src/domain/mastery.ts) value for value —
  # the fixture's meta.config pins this equality in spec/lib/mastery_spec.rb.
  WINDOW = 5
  OUTCOME_VALUES = { "correct" => 1.0, "partial" => 0.5, "wrong" => 0.0 }.freeze
  MASTERED_THRESHOLD = 80
  EVIDENCE_GATE = 3
  FRESHNESS_DAYS = 14

  # ADR-0001 amendment 2026-11-02: below the evidence gate a node's score caps
  # here — 100 anywhere must mean verified mastery. Amendment 2026-11-04 adds
  # the freshness cap to the same value: both are "display at most 99".
  UNVERIFIED_CAP = 99

  SECONDS_PER_DAY = 86_400

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
    # Below EVIDENCE_GATE — or, with `now` injected, past the freshness window
    # on the node's LATEST record — the score caps at UNVERIFIED_CAP (the two
    # caps compose as the max of two "display at most 99" caps; ADR-0001
    # amendments 2026-11-02 + 2026-11-04: the caps cap the SCORE, not only the
    # state, so a stale node can never certify).
    def node_stats(records, now: nil)
      records = records.to_a
      return NodeStats.new(score: 0, state: "uncovered", mean_of_windowed_values: nil) if records.empty?

      stale = !now.nil? && freshness_expired?(records, now)
      values = recent_first(records).first(WINDOW).map { |r| OUTCOME_VALUES.fetch(r.outcome.to_s) }
      # Naive left-to-right summation — ECMAScript reduce's order, NOT
      # Array#sum's compensated one; the float path must be bit-identical
      # to the TS source (the outcome values are exact halves, so both agree
      # here, but the port pins the order anyway).
      mean = values.inject(0.0) { |sum, v| sum + v } / values.length
      raw = (100 * mean).round # Math.round semantics: ties toward +∞ for these non-negative values
      score = records.length >= EVIDENCE_GATE && !stale ? raw : [ raw, UNVERIFIED_CAP ].min

      NodeStats.new(score: score, state: state_for(records, score, stale), mean_of_windowed_values: mean)
    end

    # The node's displayed score (0..100). `now:` engages the freshness cap
    # (nil keeps the Phase-1 read — ADR-0001 amendment 2026-11-04).
    def compute_node_score(records, now: nil)
      node_stats(records, now: now).score
    end

    # "uncovered" (no evidence) / "partial" / "mastered" (score ≥ threshold AND
    # ≥ EVIDENCE_GATE total records AND fresh — the anti-inflation gate, SM-C2,
    # plus the freshness window; a decayed node never reads mastered).
    def node_state(records, now: nil)
      node_stats(records, now: now).state
    end

    # Per-node summaries in the hash's key order (the rollup's node rows).
    def summarize_nodes(evidence_by_node, now: nil)
      evidence_by_node.map do |node_id, records|
        stats = node_stats(records, now: now)
        NodeSummary.new(node_id: node_id, score: stats.score, state: stats.state)
      end
    end

    # Plan rollup (AD-6): mean of node scores with uncovered nodes counting 0,
    # FLOORED once to the whole percent (ADR-0001 amendment 2026-11-04). Floor —
    # not half-up — is what restores the readiness invariant: (n·100−1)/n is
    # strictly below 100 for every n, so the rollup reads 100 only when every
    # node scores 100, and a node scores 100 only past the evidence gate — i.e.
    # rollup 100 ⇔ every node mastered. With `now` injected the node scores
    # carry freshness, so a decayed node caps at 99 and can never certify
    # (amendment 2026-11-04, ticket 04) — the invariant survives the layer.
    # Integer operands keep this exact (the TS Math.floor(total / count) is
    # identical at any realistic plan size).
    def compute_plan_rollup(evidence_by_node, now: nil)
      summaries = summarize_nodes(evidence_by_node, now: now)
      return 0 if summaries.empty?

      total = summaries.sum(&:score)
      (total.to_f / summaries.length).floor
    end

    # Study Task rollup (AD-6): exactly its single owned node's score — no other
    # rollup exists.
    def compute_task_rollup(records, now: nil)
      node_stats(records, now: now).score
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

    def state_for(records, score, stale)
      if !stale && score >= MASTERED_THRESHOLD && records.length >= EVIDENCE_GATE
        "mastered"
      else
        "partial"
      end
    end

    # The freshness cap predicate (ADR-0001 amendment 2026-11-04, ticket 04):
    # the node's LATEST record (newest created_at — the window's own recency
    # key) is STRICTLY more than FRESHNESS_DAYS old. Exactly 14 days is fresh;
    # 14 days + 1 second is stale. Plain Time subtraction keeps whole-second
    # instants exact, matching the TS millisecond arithmetic bit for bit.
    def freshness_expired?(records, now)
      latest = records.map(&:created_at).max
      (now - latest) > FRESHNESS_DAYS * SECONDS_PER_DAY
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
