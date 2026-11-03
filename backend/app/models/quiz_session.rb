# frozen_string_literal: true

# An Open/Choice/Mix quiz session (Quiz = Open + Choice + Mix). Generated from
# a plan or a task — exactly one of plan_id/task_id in practice. The TS shape's
# questionIds is the has_many inverse below, not a column.
class QuizSession < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true

  has_many :questions

  enum :mode, { open: "open", choice: "choice", mix: "mix" }, scopes: false
  enum :status, { active: "active", completed: "completed", abandoned: "abandoned" },
       default: :active, scopes: false
end
