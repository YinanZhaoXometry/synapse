# frozen_string_literal: true

# AD-13/AD-6: StudyTask — plan-free single-document study; owns exactly one
# Material and exactly one auto-created KnowledgeNode. This table closes the
# two mutual references: knowledge_nodes.task_id and materials.task_id point
# at it (the columns/indexes were created with their tables; the constraints
# land here, the first point both endpoints exist). strong_migrations: the FKs
# are added NOT VALID and validated in ValidateTaskForeignKeys.
class CreateStudyTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :study_tasks, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true
      t.references :node, type: :uuid, null: false, foreign_key: { to_table: :knowledge_nodes }

      t.timestamps
    end

    add_foreign_key :knowledge_nodes, :study_tasks, column: :task_id, validate: false
    add_foreign_key :materials, :study_tasks, column: :task_id, validate: false
  end
end
