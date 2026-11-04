# frozen_string_literal: true

# The notes table (FR-40, epic P2-12 T1, delta decision 4): AI-authored
# Markdown study notes persisted as a user-scoped entity. One scope per note —
# the scope string and the EXACTLY-ONE matching scope id are pinned by the DB
# check floor (plan → plan_id, node → node_id, material → material_id; the
# other two stay null), so a note's address is unambiguous at the storage
# layer, not just at the command. The three scope references all ride nullable
# — the scope decides which one carries the row. `enrichment` is the jsonb
# marker array (delta decision 1's markers-only v1: the model's
# [[enrich|kind|suggestion]] placement markers, extracted from the body for
# structured reads; the body keeps them verbatim). `targeting` is T2's
# weak-spot provenance (empty for v1).
class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.references :plan, type: :uuid
      t.references :node, type: :uuid
      t.references :material, type: :uuid
      t.string :scope, null: false
      t.string :title, null: false
      t.text :body, null: false
      t.jsonb :enrichment, null: false, default: []
      t.jsonb :targeting, null: false, default: []

      t.timestamps

      t.check_constraint "scope IN ('plan', 'node', 'material')", name: "notes_scope_check"
      t.check_constraint <<~SQL, name: "notes_scope_id_xor_check"
        (scope = 'plan' AND plan_id IS NOT NULL AND node_id IS NULL AND material_id IS NULL)
        OR (scope = 'node' AND node_id IS NOT NULL AND plan_id IS NULL AND material_id IS NULL)
        OR (scope = 'material' AND material_id IS NOT NULL AND plan_id IS NULL AND node_id IS NULL)
      SQL
    end

    add_foreign_key :notes, :users, validate: false
    # The scope columns are not Rails-inferrable references by name — declared
    # explicitly (the material_node_mappings node_id precedent).
    add_foreign_key :notes, :study_plans, column: :plan_id, validate: false
    add_foreign_key :notes, :knowledge_nodes, column: :node_id, validate: false
    add_foreign_key :notes, :materials, validate: false
  end
end
