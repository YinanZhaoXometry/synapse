# frozen_string_literal: true

# The study_focus_sets table (FR-17, epic-13 T4; OQ-1): ONE active Study
# Focus set per user+material — the storage shape decision recorded on the
# ticket (a single-row-per-material set, NOT per-item rows): regeneration
# REPLACES the row's items in place and bumps the `generation` counter (the
# wire's vN chip; no forked history v1). `items` is the jsonb array
# (string-keyed, TS keys verbatim: [{ id, title, detail, sourceRange }] —
# sourceRange is the AD-2 annotation range jsonb VERBATIM, the deep-link
# shape). `client_uuid` is the delta-3 replay key of the set's LAST
# generation (globally unique — the uuid is owned by exactly one user;
# regeneration replaces it, so v1 is no longer addressable). The unique
# index on (user_id, material_id) IS the one-active-set law at the storage
# layer.
class CreateStudyFocusSets < ActiveRecord::Migration[8.1]
  def change
    create_table :study_focus_sets, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.references :material, type: :uuid, null: false, index: true
      t.string :client_uuid, null: false
      t.jsonb :items, null: false, default: []
      t.integer :generation, null: false, default: 1

      t.timestamps

      t.index :client_uuid, unique: true
      t.index [ :user_id, :material_id ], unique: true, name: "index_study_focus_sets_on_user_and_material"
    end

    add_foreign_key :study_focus_sets, :users, validate: false
    add_foreign_key :study_focus_sets, :materials, validate: false
  end
end
