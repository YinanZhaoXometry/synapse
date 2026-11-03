# frozen_string_literal: true

# A card seeded from a material (node attribution optional). difficulty is the
# user's self-rating and NEVER creates EvidenceRecords (GLOSSARY).
class Flashcard < ApplicationRecord
  belongs_to :user
  belongs_to :material
  belongs_to :node, class_name: "KnowledgeNode", optional: true

  enum :difficulty, { hard: "hard", medium: "medium", easy: "easy" }, scopes: false
end
