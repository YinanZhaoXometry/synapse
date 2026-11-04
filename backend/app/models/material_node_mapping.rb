# frozen_string_literal: true

# One material section's mapping state against the plan's node layer (FR-45,
# epic P2-10 ticket 01, delta decision 4): the AI map run proposes, the user
# confirms or rejects, and the row is the durable record — not ephemeral
# chat. ONE ACTIVE row per user+material+section (the unique index): status
# transitions update in place, so a rejected section is never re-proposed
# (the map command skips it) and a confirmed mapping is never overwritten by
# a re-run (the map command leaves it alone).
#
# `node` is null on proposals (the gap named by proposed_node_title, or the
# truly-orphan Unmapped row carrying neither) and set on confirm — either the
# mapped existing node or the ONE real node created per proposed-title group.
class MaterialNodeMapping < ApplicationRecord
  belongs_to :user
  belongs_to :material
  belongs_to :node, class_name: "KnowledgeNode", optional: true

  # Closed vocabulary pinned twice: the enum here (model seam) + the check
  # constraint in the migration (database floor). scopes: false — `rejected`
  # would otherwise shadow a scope named after the enum value.
  enum :status, { proposed: "proposed", confirmed: "confirmed", rejected: "rejected" },
       default: :proposed, scopes: false
end
