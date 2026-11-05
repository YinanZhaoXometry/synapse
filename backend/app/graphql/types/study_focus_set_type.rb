# frozen_string_literal: true

module Types
  # The ONE active Study Focus set for a user+material (FR-17, epic-13 T4;
  # OQ-1): AI-generated from the material's annotations through the AD-16
  # seam (one cap-counted call), regenerable, REPLACEABLE — regeneration
  # updates the row in place and bumps `generation` (the wire's vN chip);
  # there is no forked history v1.
  class StudyFocusSetType < Types::BaseObject
    description "The caller's active Study Focus set for one material (FR-17): core items distilled from the material's annotations. Regeneration replaces the items and bumps generation — one active set per user+material."

    field :id, String,
          null: false,
          description: "The set's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The distilled material's uuid."

    field :items, [ Types::StudyFocusItemType ],
          null: false,
          description: "The active generation's core items, in the model's delivery order."

    field :generation, Int,
          null: false,
          description: "The regeneration counter (vN): 1 for the first generation, +1 on every regeneration (the set is replaced in place — no forked history)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the set was first generated."

    field :updated_at, Types::DateTime,
          null: false,
          description: "When the active generation landed."

    def material_id
      object.material_id
    end
  end
end
