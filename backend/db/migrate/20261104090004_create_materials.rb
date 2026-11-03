# frozen_string_literal: true

# AD-13/AD-7: Material — metadata + extracted sections only. File bytes go to
# object storage (ActiveStorage → R2) in the storage epic; there are no blob
# columns here. `sections` is the MaterialSection[] jsonb (no MaterialSection
# entity in the ER — adding one would rename the spine). task_id's FK
# constraint is added in CreateStudyTasks (mutual reference).
class CreateMaterials < ActiveRecord::Migration[8.1]
  def change
    create_table :materials, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :plan, type: :uuid, foreign_key: { to_table: :study_plans }
      t.references :task, type: :uuid, index: { unique: true }
      t.string :title, null: false
      t.string :kind, null: false
      t.bigint :size_bytes, null: false
      t.string :parse_state, null: false, default: "pending"
      t.string :parse_failure_reason
      t.jsonb :sections, null: false, default: []
      t.check_constraint "kind IN ('pdf', 'markdown')", name: "materials_kind_check"
      t.check_constraint "parse_state IN ('pending', 'parsing', 'parsed', 'failed')",
                         name: "materials_parse_state_check"
      t.check_constraint "parse_failure_reason IS NULL OR parse_failure_reason IN " \
                         "('corrupt', 'encrypted', 'empty', 'unknown')",
                         name: "materials_parse_failure_reason_check"

      t.timestamps
    end
  end
end
