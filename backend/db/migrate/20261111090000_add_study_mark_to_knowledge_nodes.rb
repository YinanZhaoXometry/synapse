# frozen_string_literal: true

# The Study Mark (FR-47, epic-28 T1): a nullable per-node self-declared
# status (`learning | finished | skipped`, application-layer enum). It is the
# user's "where I say I am" — ORTHOGONAL to mastery by contract: nothing
# computational reads it (ADR: docs/adr/0002-study-mark-orthogonal-to-mastery),
# mastery stays evidence-only (ADR-0001) and the mastery-vector anti-drift
# suite must pass untouched. Plain nullable column, no backfill: marks are
# user-authored facts from the moment they exist, never invented for legacy
# rows.
class AddStudyMarkToKnowledgeNodes < ActiveRecord::Migration[8.1]
  def change
    add_column :knowledge_nodes, :study_mark, :string
  end
end
