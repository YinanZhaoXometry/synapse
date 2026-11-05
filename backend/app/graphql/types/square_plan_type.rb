# frozen_string_literal: true

module Types
  # A study plan, as the Square sees it (FR-39, epic P2-11 T2): the reduced,
  # separate public type set the AD-13 exception is built on. The
  # leak-proofing is STRUCTURAL (the spec's implementation decision) — the
  # header (id/topic/goal/visibility/createdAt) plus stage-ordered node
  # summaries, and NOTHING else: no materials, no annotations, no scores,
  # no owner identity, no task refs. There are no content fields on this
  # type to select, so a public answer cannot carry them (NFR-7), and no
  # field of it unwraps into an authenticated type — a separate class, not
  # StudyPlanType with fields toggled off (the epic P2-4 forward-note).
  #
  # Rows reach this type ONLY through the explicit StudyPlan.publicly_visible
  # scope (the stricter public-path scoping, per the P2-4 review) and nodes
  # only through the plan's own association — never a bare model reach.
  # Pinned field-for-field by spec/graphql/square_public_types_spec.rb (the
  # leak-proof AC) and consumed by the unauthenticated squarePlans/squarePlan
  # queries.
  class SquarePlanType < Types::BaseObject
    description "A public study plan's structure-only Square view (FR-39, the AD-13 exception): the plan header plus stage-ordered node summaries — no materials, annotations, scores, or owner identity exist on it to select (NFR-7)."

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
          description: "Always \"public\" here — the Square only ever answers publicly_visible plans."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the plan was created."

    field :node_summaries, [ Types::SquareNodeSummaryType ],
          null: false,
          description: "The plan's structure, stage-ordered — the node tree's title/stage/order summaries (the fork command's input shape for T3)."

    # The node summaries in one association pass: the resolver preloaded
    # knowledge_nodes (squarePlans), so this reads the loaded association —
    # and for the single squarePlan read it is the one node query either way
    # (no per-plan N+1 on the list). In-memory sort: the association carries
    # no default order, and an .order here would re-query even a preloaded
    # association. Stage order rides the node tree's own `order` key — the
    # same seam as StudyPlanType#nodes.
    def node_summaries
      object.knowledge_nodes.sort_by(&:order)
    end
  end
end
