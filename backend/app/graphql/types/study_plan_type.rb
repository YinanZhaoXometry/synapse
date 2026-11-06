# frozen_string_literal: true

module Types
  # A study plan (AD-3) — the front door. The wire shape mirrors the Phase-1
  # TS StudyPlan (frontend/src/domain/entities.ts) where the wire is
  # concerned: id/topic/goal/createdAt verbatim; the TS nodeIds/materialIds
  # arrays are realized as associations (nodes here — materials arrive with
  # the materials ticket); visibility is the backend-only passthrough
  # (FR-38 — the TS shape has none).
  #
  # masteryScore (the rollup) landed with epic P2-4 ticket 03, per the
  # epic-03 ticket-1 placement decision — marshaled through Mastery, never
  # computed here (AD-6/AD-14).
  class StudyPlanType < Types::BaseObject
    description "A study plan (AD-3): the system gives the plan, never content."

    field :id, String,
          null: false,
          description: "The plan's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :topic, String,
          null: false,
          description: "What the plan studies."

    field :goal, String,
          null: true,
          description: "The optional study goal."

    field :visibility, String,
          null: false,
          description: "\"private\" (FR-38 default) or \"public\" (the Square opt-in)."

    # The fork attribution (OQ-12, epic P2-11 T3; delta decision 4): the
    # fork-time topic snapshot of the Square source, set only on adopted
    # plans. The source's id deliberately stays off the wire — the public
    # path is structure-only and the source may have gone private since; the
    # wire carries the attribution LINE, never a pointer back.
    field :forked_from_topic, String,
          null: true,
          description: "The forked plan's attribution line: the source plan's topic, snapshotted at fork time (OQ-12). Null on every plan that is not a fork."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the plan was created."

    field :nodes, [ Types::KnowledgeNodeType ],
          null: false,
          description: "The plan's node tree (the Phase-1 nodeIds array, realized as the association)."

    # The stored prerequisite graph (epic-16 T1, FR-5 data half): the plan's
    # edges as endpoint id pairs. Empty on legacy plans — edges are
    # new-generation artifacts (epic-16 delta decision 7: zero-edge plans
    # keep rendering via the client's derived-sequence fallback).
    field :edges, [ Types::PlanEdgeType ],
          null: false,
          description: "The plan's prerequisite edges (epic-16): each edge's from/to endpoint uuids. Empty on legacy plans — a zero-edge plan renders via the client's derived-sequence fallback."

    field :materials, [ Types::MaterialType ],
          null: false,
          description: "The plan's attached materials (the Phase-1 materialIds array, realized as the association — deferred from ticket 01 to the materials ticket)."

    # The plan rollup (epic P2-4 ticket 03): marshals every node's evidence —
    # the uncovered ones included, counting 0 (AD-6) — into Mastery's
    # floored mean. Scoping rides the association path (the epic-03 reads
    # convention): object came through the caller's own association path, so
    # its nodes and the evidence pinned to them (same user_id) are the
    # caller's own. `now: Time.current` carries freshness into the node
    # scores (ADR-0001 amendment 2026-11-04, ticket 04): a decayed node caps
    # at 99 and can never certify, so rollup 100 ⇔ every node mastered
    # survives the freshness layer.
    field :mastery_score, String,
          null: false,
          description: "The plan's Mastery Score rollup (ADR-0001) as a string carrying the integer percent \"0\"..\"100\" — the floored mean of its nodes' scores with uncovered nodes counting 0; computed by the api's Mastery module (the client renders, never recomputes, AD-14). Node scores carry the freshness cap (ADR-0001 amendment 2026-11-04): a node whose latest evidence is more than 14 days old caps at \"99\", so a decayed node can never certify. Rollup 100 ⇔ every node mastered."

    def mastery_score
      nodes = object.knowledge_nodes.to_a
      # (created_at, id) order = the deterministic SQL seam (review P2-5a,
      # same posture as the node fields' DataloaderSources::EvidenceRecordsSource):
      # Mastery's window sort resolves equal-timestamp ties against this
      # array's order, so the rollup is order-deterministic too.
      records = EvidenceRecord.where(user_id: object.user_id, node_id: nodes.map(&:id))
        .order(:created_at, :id)
        .group_by(&:node_id)
      Mastery.compute_plan_rollup(nodes.to_h { |node| [ node.id, records.fetch(node.id, []) ] }, now: Time.current).to_s
    end

    # The listNodesByPlan mirror (frontend/src/data/plan-repository.ts):
    # order is the sort key, verbatim.
    def nodes
      object.knowledge_nodes.order(:order)
    end

    # The stored edge set, in insertion order (created_at, id) — the
    # deterministic SQL seam (review P2-5a posture), so the wire is stable
    # across replays of the same plan.
    def edges
      object.knowledge_node_edges.order(:created_at, :id)
    end

    # The plan-scoped material listing (frontend/src/data/material-repository.ts
    # listMaterialsByPlan), in attach order.
    def materials
      object.materials.order(:created_at)
    end
  end
end
