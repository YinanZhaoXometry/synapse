# frozen_string_literal: true

module Ai
  # Adaptive weak-spot targeting (FR-21, epic P2-10 T5): the pure selection/
  # weighting layer over the existing materials-sourced generation pipeline —
  # never a new question shape or a non-materials source (FR-18). The
  # delta-grill's recorded weights (epic.md kickoff decision 2, BINDING):
  #
  #   w(node) = 1 + (100 − masteryScore)/50   (+1.0 flat bonus on ≥ 1 mistake
  #                                            entry), capped at 4.0
  #
  # — score 100 → 1.0, score 0 → 3.0, mistake bonus pushes to 4.0 at most.
  # The score arrives in the server's published form, the String! percent
  # ("0".."100"; uncovered/no-evidence → "0"); anything unparsable reads 0,
  # the weakest possible posture, so a malformed value biases toward the
  # node rather than silently dropping it from targeting.
  #
  # Allocation distributes the quiz's question total across the candidate
  # nodes by LARGEST REMAINDER over the weights (the recorded delta-grill
  # method): exact fractional shares are floored, and the leftover seats go
  # to the largest fractional remainders. Deterministic throughout — ties
  # break by node order (the caller's input order: `order`, then id) then id
  # — and exact: the quotas sum to the total with no float drift (Rational
  # arithmetic end to end). Quotas are never negative; every candidate stays
  # present (a 0 quota is a real, published "this node gets nothing").
  #
  # Pure math: no I/O, no clock — the command layer fetches scores and
  # mistake counts and builds the Candidates (AD-14: the ONE score source —
  # Mastery — is consulted there, never re-implemented here).
  module Targeting
    # One candidate node: `id` the node uuid, `score` the server's String!
    # percent (Integer tolerated), `mistakes` the node's MistakeEntry count.
    Candidate = Struct.new(:id, :score, :mistakes, keyword_init: true)

    MAX_WEIGHT = 4.0
    MISTAKE_BONUS = 1.0

    class << self
      # The recorded per-node weight, as a Float for readability. The exact
      # Rational form (weight_r) backs the allocation.
      def weight(score:, mistakes: 0)
        weight_r(score: score, mistakes: mistakes).to_f
      end

      # The quiz's per-node question quotas: { candidate id => Integer quota },
      # summing EXACTLY to `total`. `candidates` ride in NODE ORDER (the
      # command passes plan.knowledge_nodes.order(:order, :id)) — that order
      # is the first tie-break, the id the second.
      def allocate(candidates:, total:)
        seats = total.to_i
        return {} if candidates.empty?

        weights = candidates.map { |candidate| weight_r(score: candidate.score, mistakes: candidate.mistakes) }
        total_weight = weights.sum
        # Weights are ≥ 1.0 by construction, so total_weight > 0 whenever a
        # candidate exists — the zero guard is shape-robustness, not math.
        return candidates.to_h { |candidate| [ candidate.id, 0 ] } if seats <= 0 || total_weight <= 0

        exact = candidates.zip(weights).map { |candidate, w| Rational(seats) * w / total_weight }
        floors = exact.map(&:floor)
        leftover = seats - floors.sum

        # Largest remainder, deterministic: fractional remainder desc, then
        # the caller's node order asc, then id asc. The leftovers are < the
        # candidate count, so each node gains at most one seat here.
        order = exact.each_index.sort_by { |index| [ -exact[index] + floors[index], index, candidates[index].id.to_s ] }
        order.first(leftover).each { |index| floors[index] += 1 }

        candidates.zip(floors).to_h { |candidate, quota| [ candidate.id, quota ] }
      end

      private

      # The exact weight: 1 + (100 − score)/50 + (mistakes ≥ 1 ? 1 : 0),
      # capped at 4.0 — Rational end to end so the remainder math above
      # never drifts.
      def weight_r(score:, mistakes:)
        raw = Rational(150 - clamp_score(score) + (mistakes.to_i.positive? ? 50 : 0), 50)
        [ raw, Rational(MAX_WEIGHT) ].min
      end

      def clamp_score(score)
        # `exception: false` returns nil on unparsable input instead of raising
        # (no ArgumentError to rescue) — nil falls back to 0, the weakest
        # possible posture, per this module's documented contract above.
        value = Integer(score.to_s.strip, exception: false)
        value = 0 if value.nil?
        value.clamp(0, 100)
      end
    end
  end
end
