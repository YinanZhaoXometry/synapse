# frozen_string_literal: true

# A StudyPlan's structural unit (plan has many nodes) or a Study Task's single
# auto-created node (plan_id null, task_id set — AD-6). `order` is the TS field
# name verbatim (a reserved SQL word; ActiveRecord quotes column names).
class KnowledgeNode < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true

  has_many :evidence_records
end
