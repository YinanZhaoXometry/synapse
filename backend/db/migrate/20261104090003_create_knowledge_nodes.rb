# frozen_string_literal: true

# AD-13: KnowledgeNode — plan structure (a plan has many nodes) or a Study
# Task's single auto-created node (plan_id null, AD-6). `order` is the TS
# field name verbatim; it is a reserved SQL word, which ActiveRecord handles
# by quoting every column name. task_id's FK constraint is added in
# CreateStudyTasks (mutual reference — the tasks table exists only from there).
class CreateKnowledgeNodes < ActiveRecord::Migration[8.1]
  def change
    create_table :knowledge_nodes, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :plan, type: :uuid, foreign_key: { to_table: :study_plans }
      t.references :task, type: :uuid, index: { unique: true }
      t.string :stage
      t.string :title, null: false
      t.integer :order, null: false

      t.timestamps
    end
  end
end
