# frozen_string_literal: true

module Types
  # One material section's mapping state against the plan's node layer
  # (FR-45, epic P2-10 T1): the AI map run proposes, the user confirms or
  # rejects — the row IS the durable proposal (never ephemeral chat). ONE
  # ACTIVE row per user+material+section (delta decision 4): status
  # transitions update in place, so a rejected section is never re-proposed
  # and a confirmed mapping is never overwritten by a re-run.
  class MaterialNodeMappingType < Types::BaseObject
    description "A material section's node-mapping state (FR-45): proposed (awaiting the user), confirmed (a real node now owns the section), or rejected (never re-proposed). One active row per user+material+section."

    field :id, String,
          null: false,
          description: "The mapping row's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The mapped material's uuid."

    field :node_id, String,
          null: true,
          description: "The mapped node's uuid once the row targets a node — set on proposals pointing at an existing node and preserved on rejection; null only for proposed-new-node and unmapped rows. On confirm it is either the mapped existing node or the ONE node created for the confirmed proposal group."

    field :section_id, String,
          null: false,
          description: "The mapped section's stable id (a MaterialSection id string — a slug, not a uuid)."

    field :proposed_node_title, String,
          null: true,
          description: "The proposed new node's title for a coverage gap (null on rows mapped onto an existing node and on the explicit Unmapped rows). Kept on rejected rows as the historical record."

    field :status, String,
          null: false,
          description: "\"proposed\" | \"confirmed\" | \"rejected\" — the delta-decision-4 state machine, updated in place."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the mapping row was first proposed."
  end
end
