# frozen_string_literal: true

# AD-13: StudyPlan — the front-door entity (system gives the plan). visibility
# is the FR-38 structural field (Square's public-plan read path): private by
# default, public is the opt-in. nodeIds/materialIds from the Phase-1 TS shape
# are the has_many inverses (knowledge_nodes.plan_id / materials.plan_id), not
# columns.
class CreateStudyPlans < ActiveRecord::Migration[8.1]
  def change
    create_table :study_plans, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string :topic, null: false
      t.string :goal
      t.string :visibility, null: false, default: "private"
      t.check_constraint "visibility IN ('private', 'public')", name: "study_plans_visibility_check"

      t.timestamps
    end
  end
end
