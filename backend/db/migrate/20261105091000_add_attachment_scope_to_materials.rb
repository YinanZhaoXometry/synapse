# frozen_string_literal: true

# Attachment scope (FR-44, epic P2-10 T2; kickoff delta decision 4): a
# material is either plan-wide (the default — existing rows read plan-wide
# with NO backfill: the default IS plan, a constant fast default on
# Postgres 17) or pinned to one plan node (nullable node_id). The check
# constraint is the database floor over the closed two-value vocabulary;
# scope↔node pairing (node requires scope=node, scope=node requires a node
# in the material's plan) lives in the command layer.
#
# strong_migrations two-step pattern (the material_node_mappings
# precedent): the FK + check constraint land NOT VALID here and validate in
# the follow-up migration. The node_id index builds concurrently (existing
# table — a blocking index build is refused by strong_migrations).
class AddAttachmentScopeToMaterials < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :materials, :attachment_scope, :string, null: false, default: "plan"
    add_check_constraint :materials, "attachment_scope IN ('plan', 'node')",
                         name: "materials_attachment_scope_check", validate: false
    add_column :materials, :node_id, :uuid
    add_foreign_key :materials, :knowledge_nodes, column: :node_id, validate: false
    add_index :materials, :node_id, algorithm: :concurrently
  end
end
