# frozen_string_literal: true

# AD-15: the scoping root — every user-owned row carries user_id (AD-13).
# has_secure_password lands with the auth epic (P2-2 ticket 01): bcrypt
# digesting + `authenticate` here; all credential validation (email shape,
# password minimum) stays command-side per epic-01's minimal-model posture.
class User < ApplicationRecord
  has_secure_password

  has_many :study_plans
  has_many :materials
  has_many :knowledge_nodes
  has_many :knowledge_node_edges
  has_many :study_tasks
  has_many :quiz_sessions
  has_many :questions
  has_many :evidence_records
  has_many :flashcards
  has_many :mistake_entries
  has_many :notes
  has_many :chat_threads
  has_many :reading_progresses
  has_many :section_markings
  has_many :annotations
  has_many :study_focus_sets
  has_many :material_node_mappings
  has_many :today_suggestions
  has_many :manual_tasks
  has_many :requeue_schedules
  has_many :ai_usage_counters
  has_many :stream_tickets

  validates :email, presence: true, uniqueness: true
end
