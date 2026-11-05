# frozen_string_literal: true

# Plan-free single-document study (AD-6): owns exactly one Material and one
# auto-created KnowledgeNode. The pair is mutually referential — insert the
# node first (task_id null), then the task, then set node.task_id.
class StudyTask < ApplicationRecord
  belongs_to :user
  belongs_to :material
  belongs_to :node, class_name: "KnowledgeNode"

  # The promotion pointer (FR-37 stretch, epic-14 T2): the plan this task
  # became, null while the task is plan-free. The promoted state is INFERRED
  # from this column — no boolean second truth. Optional + inverse_of: false
  # (one-directional link, like forked_from).
  belongs_to :promoted_plan, class_name: "StudyPlan", optional: true, inverse_of: false

  # The child table's foreign key is `task_id` (t.references :task), not the
  # `study_task_id` a bare has_many would infer — declared explicitly per
  # the epic P2-2 review's association-integrity sweep (the same landmine
  # class StudyPlan's has_many hit in ticket 03).
  has_many :quiz_sessions, foreign_key: :task_id

  # The promoted vocabulary (delta decision 4 — inferred, never a boolean).
  scope :promoted, -> { where.not(promoted_plan_id: nil) }
  scope :not_promoted, -> { where(promoted_plan_id: nil) }
end
