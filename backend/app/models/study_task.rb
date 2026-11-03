# frozen_string_literal: true

# Plan-free single-document study (AD-6): owns exactly one Material and one
# auto-created KnowledgeNode. The pair is mutually referential — insert the
# node first (task_id null), then the task, then set node.task_id.
class StudyTask < ApplicationRecord
  belongs_to :user
  belongs_to :material
  belongs_to :node, class_name: "KnowledgeNode"

  has_many :quiz_sessions
end
