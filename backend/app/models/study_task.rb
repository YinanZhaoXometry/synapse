# frozen_string_literal: true

# Plan-free single-document study (AD-6): owns exactly one Material and one
# auto-created KnowledgeNode. The pair is mutually referential — insert the
# node first (task_id null), then the task, then set node.task_id.
class StudyTask < ApplicationRecord
  belongs_to :user
  belongs_to :material
  belongs_to :node, class_name: "KnowledgeNode"

  # The child table's foreign key is `task_id` (t.references :task), not the
  # `study_task_id` a bare has_many would infer — declared explicitly per
  # the epic P2-2 review's association-integrity sweep (the same landmine
  # class StudyPlan's has_many hit in ticket 03).
  has_many :quiz_sessions, foreign_key: :task_id
end
