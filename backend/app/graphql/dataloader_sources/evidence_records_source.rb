# frozen_string_literal: true

module DataloaderSources
  # Batched evidence load behind the per-node Mastery fields (epic P2-4 review,
  # finding P2-4): KnowledgeNodeType#mastery_score/#state used to fire
  # `object.evidence_records` per node — N evidence queries per plan read. This
  # source keys by node_id and answers every node a request touches with ONE
  # batched query per Dataloader tick.
  #
  # Scoping posture (the review asked the source to pick and document one): the
  # fetch scopes by the CURRENT USER explicitly — `EvidenceRecord.where(user_id:,
  # node_id:)` — the stricter of the codebase's two postures (StudyPlanType's
  # rollup scopes the same way; the pre-review node fields relied on the bare
  # `object.evidence_records` association and the caller having resolved the node
  # through the user's own plan/task reads). Source-level user scoping means the
  # score fields cannot leak cross-user rows even if a foreign node ever reaches
  # them — the Square's future public-plan read (NFR-7) inherits the guarantee.
  # The user_id rides `initialize`, so the per-request source instance is also
  # keyed per user. The fields assume the operation-level auth guard ran (the
  # plan/task reads demand authentication before any node resolves) — a missing
  # current user fails loudly here rather than silently reading zero scores.
  #
  # The fetch orders by (created_at, id) so the array each node receives is
  # deterministic at the SQL seam (review P2-5a): Mastery re-sorts the array
  # newest-first internally and resolves equal-timestamp ties against this
  # array's order.
  class EvidenceRecordsSource < GraphQL::Dataloader::Source
    def initialize(user_id)
      @user_id = user_id
      super()
    end

    # One batched query per tick. Returns one result per requested node_id, in
    # request order — a node with no evidence gets [] (Mastery reads that as
    # uncovered / score 0).
    def fetch(node_ids)
      grouped = EvidenceRecord
        .where(user_id: @user_id, node_id: node_ids)
        .order(:created_at, :id)
        .group_by(&:node_id)
      node_ids.map { |id| grouped[id] || [] }
    end
  end
end
