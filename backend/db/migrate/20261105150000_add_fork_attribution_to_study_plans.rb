# frozen_string_literal: true

# The fork attribution columns (OQ-12, epic P2-11 T3, delta decision 4):
# forked_from_plan_id points at the Square source the structure was copied
# from; forked_from_topic snapshots the source's topic AT FORK TIME (a copy,
# not a reference — the source's later renames never rewrite the adopted
# plan's attribution line).
#
# The FK is nullable + ON DELETE SET NULL: the source vanishing (deleted, or
# its row otherwise leaving the table) never breaks the fork — the adopted
# plan stands alone with its topic snapshot intact. Self-referential on
# study_plans, with the strong_migrations two-step dance (the standing
# pattern — validate: false here, the validate migration right behind) and
# the FK's index built concurrently (existing table — the attachment-scope
# precedent).
class AddForkAttributionToStudyPlans < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :study_plans, :forked_from_plan_id, :uuid
    add_column :study_plans, :forked_from_topic, :string

    add_foreign_key :study_plans, :study_plans, column: :forked_from_plan_id,
                                               on_delete: :nullify, validate: false
    add_index :study_plans, :forked_from_plan_id, algorithm: :concurrently
  end
end
