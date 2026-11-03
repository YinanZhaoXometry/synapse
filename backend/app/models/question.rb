# frozen_string_literal: true

# A quiz question — strictly materials-sourced (FR-18/NFR-1): provenance is
# source_material + source_section_id (a section slug, not a uuid). Node
# attribution is stamped at generation time and required (AD-6).
class Question < ApplicationRecord
  belongs_to :user
  belongs_to :session, class_name: "QuizSession"
  belongs_to :node, class_name: "KnowledgeNode"
  belongs_to :source_material, class_name: "Material"

  has_many :evidence_records
  has_many :mistake_entries

  enum :kind, { open: "open", choice: "choice" }, scopes: false
end
