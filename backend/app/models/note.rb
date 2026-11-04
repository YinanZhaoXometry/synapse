# frozen_string_literal: true

# One AI-authored Markdown study note (FR-40, epic P2-12 T1, delta decision
# 4): user-scoped (AD-13) with one scope per row — the scope string plus the
# EXACTLY-ONE matching scope id, pinned by the DB check floor
# (notes_scope_id_xor_check). The model carries the closed scope vocabulary
# pinned twice (the enum here + the check constraint in the migration — the
# material_node_mappings precedent); scopes: false — `plan`/`node`/`material`
# would otherwise shadow scopes named after the enum values.
#
# `enrichment` is the marker array (delta decision 1's markers-only v1: kind +
# suggestion pairs extracted from the body — the body keeps the
# [[enrich|kind|suggestion]] markers verbatim for export). `targeting` is
# T2's weak-spot provenance (empty for v1).
class Note < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :node, class_name: "KnowledgeNode", optional: true
  belongs_to :material, optional: true

  enum :scope, { plan: "plan", node: "node", material: "material" }, scopes: false
end
