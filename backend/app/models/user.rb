# frozen_string_literal: true

# AD-15 (structural): the scoping root — every user-owned row carries user_id
# (AD-13). Auth logic (bcrypt, JWT) lands with its own epic; only the column
# shape exists here.
class User < ApplicationRecord
  has_many :study_plans
  has_many :materials
  has_many :knowledge_nodes
  has_many :study_tasks
  has_many :quiz_sessions
  has_many :questions
  has_many :evidence_records
  has_many :flashcards
  has_many :mistake_entries
  has_many :chat_threads
  has_many :reading_progresses
  has_many :section_markings
  has_many :annotations

  validates :email, presence: true, uniqueness: true
end
