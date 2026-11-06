# frozen_string_literal: true

module Ai
  # The command-layer candidate builder for weak-spot targeting (FR-21/FR-22,
  # epic P2-10 T5 + P2-12 T2): every Mastery score + MistakeEntry count that
  # feeds Ai::Targeting's weights is fetched HERE, once — the ONE place the
  # bias inputs are constructed, shared verbatim by GenerateQuizCommand and
  # GenerateNoteCommand (FR-21's targeting layer is the single source; a
  # second heuristic is forbidden). Extracted verbatim from the quiz
  # command's private `targeting_candidates` when the note command grew the
  # same bias (epic P2-12 T2) — the quiz command delegates to it unchanged.
  #
  # AD-14: Mastery is the only scorer — the score rides in its published
  # String! percent form (`"0".."100"`), the wire's exact value; AD-6:
  # mistakes attribute by node. Evidence is batch-loaded once in the wire's
  # order convention (created_at, id — Mastery windows and freshness-caps
  # internally, now: Time.current like the wire resolvers). Candidates ride
  # in NODE ORDER (`order`, then id) — that order is Ai::Targeting's first
  # tie-break.
  module TargetingCandidates
    class << self
      # The plan's nodes as Candidates: id, the Mastery percent string, the
      # node's MistakeEntry count.
      #
      # The mistake bonus rides ANY entry — `resolved` included (epic-18
      # ruling, spec decision 5): the lifecycle flag landed with epic-18 T1
      # (`mistake_entries.resolved` + SetMistakeEntryResolvedCommand) is
      # display/lifecycle only and does NOT feed targeting; epic-10-T5's
      # recorded revisit hook ("Revisit if epic-09's Mistakes hub introduces
      # resolution") is honored by this explicit ruling, and the open-only
      # variant (`where(resolved: false)`) is consciously deferred to
      # epic-21, where generation-behavior changes are measured. Untouched
      # here on purpose: quiz quotas do not change in epic-18.
      def for(user:, plan:)
        nodes = plan.knowledge_nodes.order(:order, :id)
        node_ids = nodes.map(&:id)
        evidence = EvidenceRecord.where(user_id: user.id, node_id: node_ids)
                                 .order(:created_at, :id)
                                 .group_by(&:node_id)
        mistake_counts = MistakeEntry.where(user_id: user.id, node_id: node_ids).group(:node_id).count
        nodes.map do |node|
          Ai::Targeting::Candidate.new(
            id: node.id,
            score: Mastery.compute_node_score(evidence[node.id] || [], now: Time.current).to_s,
            mistakes: mistake_counts[node.id].to_i
          )
        end
      end
    end
  end
end
