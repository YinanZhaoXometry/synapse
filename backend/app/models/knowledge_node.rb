# frozen_string_literal: true

# A StudyPlan's structural unit (plan has many nodes) or a Study Task's single
# auto-created node (plan_id null, task_id set — AD-6). `order` is the TS field
# name verbatim (a reserved SQL word; ActiveRecord quotes column names).
class KnowledgeNode < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true

  # The child table's foreign key is `node_id` (t.references :node), not the
  # `knowledge_node_id` a bare has_many would infer — declared explicitly per
  # the epic P2-2 review's association-integrity sweep (the same landmine
  # class StudyPlan's has_many hit in ticket 03).
  has_many :evidence_records, foreign_key: :node_id
end
