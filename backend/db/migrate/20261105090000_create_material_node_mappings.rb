# frozen_string_literal: true

# The material–node mapping rows (FR-45, epic P2-10 ticket 01, delta decision
# 4): one ACTIVE row per user+material+section — the unique index on
# [user_id, material_id, section_id] is the "in place" part of the design:
# status transitions (proposed → confirmed | rejected) UPDATE the row, never
# insert a twin, which makes "rejected is never re-proposed" trivial (the
# rejected row stands; the map command skips the section forever).
#
# `node` is nullable two ways: a proposed row awaiting confirmation points at
# nothing (its coverage gap is named by proposed_node_title), and the
# truly-orphan proposed row (the Unmapped group) carries neither node nor
# title — every section still lands in exactly one final state (FR-45:
# nothing silently dropped). User-scoped per AD-13 like every table.
class CreateMaterialNodeMappings < ActiveRecord::Migration[8.1]
  def change
    create_table :material_node_mappings, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.references :material, type: :uuid, null: false, index: true
      t.references :node, type: :uuid
      t.string :section_id, null: false
      t.string :proposed_node_title
      t.string :status, null: false, default: "proposed"
      t.check_constraint "status IN ('proposed', 'confirmed', 'rejected')",
                         name: "material_node_mappings_status_check"

      t.timestamps

      t.index %i[user_id material_id section_id], unique: true,
              name: "index_material_node_mappings_on_user_material_section"
    end

    add_foreign_key :material_node_mappings, :users, validate: false
    add_foreign_key :material_node_mappings, :materials, validate: false
    # `node` (the column is node_id, not knowledge_node_id) — the plan node
    # that owns the section once confirmed; null on proposals/rejections.
    add_foreign_key :material_node_mappings, :knowledge_nodes, column: :node_id, validate: false
  end
end
