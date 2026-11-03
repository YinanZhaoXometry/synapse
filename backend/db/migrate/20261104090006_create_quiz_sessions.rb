# frozen_string_literal: true

# AD-13: QuizSession — generated from a plan or a task (both FKs nullable,
# exactly one is set in practice). questionIds from the Phase-1 TS shape is
# the has_many inverse (questions.session_id), not a column.
class CreateQuizSessions < ActiveRecord::Migration[8.1]
  def change
    create_table :quiz_sessions, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :plan, type: :uuid, foreign_key: { to_table: :study_plans }
      t.references :task, type: :uuid, foreign_key: { to_table: :study_tasks }
      t.string :mode, null: false
      t.string :status, null: false, default: "active"
      t.datetime :completed_at
      t.check_constraint "mode IN ('open', 'choice', 'mix')", name: "quiz_sessions_mode_check"
      t.check_constraint "status IN ('active', 'completed', 'abandoned')", name: "quiz_sessions_status_check"

      t.timestamps
    end
  end
end
