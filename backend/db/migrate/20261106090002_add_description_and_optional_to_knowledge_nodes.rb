# frozen_string_literal: true

# Node metadata for the roadmap graph (FR-5 data half, epic-16 T1): a
# nullable one-line `description` (null on legacy/ undescribed nodes) and the
# `optional` flag (default false — the "may be skipped without losing the
# thread" vocabulary the renderer draws dashed). Plain columns, no backfill:
# edges and metadata are new-generation artifacts (epic-16 delta decision 7 —
# inventing structure for legacy plans would be dishonest).
class AddDescriptionAndOptionalToKnowledgeNodes < ActiveRecord::Migration[8.1]
  def change
    add_column :knowledge_nodes, :description, :string
    add_column :knowledge_nodes, :optional, :boolean, null: false, default: false
  end
end
