# frozen_string_literal: true

# An Open/Choice/Mix quiz session (Quiz = Open + Choice + Mix). Generated from
# a plan or a task — exactly one of plan_id/task_id in practice. The TS shape's
# questionIds is the has_many inverse below, not a column.
class QuizSession < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true

  # The child table's foreign key is `session_id` (t.references :session),
  # not the `quiz_session_id` a bare has_many would infer — declared
  # explicitly per the epic P2-2 review's association-integrity sweep (the
  # same landmine class StudyPlan's has_many hit in ticket 03).
  has_many :questions, foreign_key: :session_id

  enum :mode, { open: "open", choice: "choice", mix: "mix" }, scopes: false
  enum :status, { active: "active", completed: "completed", abandoned: "abandoned" },
       default: :active, scopes: false
end
