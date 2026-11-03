# frozen_string_literal: true

# A user-attached document: metadata + extracted sections only (AD-7 — bytes
# go to ActiveStorage/R2 in the storage epic, no blob columns). plan_id
# realizes the StudyPlan ↔ Material attachment (the M2M is plan-side; no join
# table); task_id mirrors the one task studying this material.
class Material < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true

  has_many :flashcards
  has_one :chat_thread
  has_one :reading_progress
  has_many :section_markings
  has_many :annotations

  # Closed vocabularies pinned twice: enums here (model seam) + check
  # constraints in the migration (database floor). scopes: false — several
  # values (`open`, `empty`, `pending`) would collide with Ruby/Kernel names.
  enum :kind, { pdf: "pdf", markdown: "markdown" }, scopes: false
  enum :parse_state, { pending: "pending", parsing: "parsing", parsed: "parsed", failed: "failed" },
       default: :pending, scopes: false
  enum :parse_failure_reason, { corrupt: "corrupt", encrypted: "encrypted", empty: "empty", unknown: "unknown" },
       scopes: false
end
