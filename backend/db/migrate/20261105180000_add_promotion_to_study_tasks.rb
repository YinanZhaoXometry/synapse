# frozen_string_literal: true

# The FR-37 stretch half's pointer columns (epic-14 T2, delta decision 4):
# promoted_plan_id marks the promotion — the promoted state is INFERRED from
# the non-null id (no boolean; a second truth source would drift), promoted_at
# stamps when. ON DELETE SET NULL is the honest DB floor: a plan vanishing
# under the pointer un-promotes it rather than dangling — the command layer
# (Plans::DeletePlanCommand) sweeps the pointer rows before the plan's
# content goes, since study_tasks.material_id/node_id are NOT NULL and the
# pointer cannot outlive what it points at.
#
# strong_migrations two-step dance (the standing pattern — the fork
# attribution precedent): FK added validate: false here, validated in
# ValidateStudyTasksPromotionFk; the FK's index built concurrently (existing
# table).
class AddPromotionToStudyTasks < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :study_tasks, :promoted_plan_id, :uuid
    add_column :study_tasks, :promoted_at, :datetime

    add_foreign_key :study_tasks, :study_plans, column: :promoted_plan_id,
                                                on_delete: :nullify, validate: false
    add_index :study_tasks, :promoted_plan_id, algorithm: :concurrently
  end
end
