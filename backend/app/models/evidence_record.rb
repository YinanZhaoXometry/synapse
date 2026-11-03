# frozen_string_literal: true

# The only unit that moves a Mastery Score (GLOSSARY): one graded quiz answer,
# node-attributed (AD-6, required). A forfeit (「看答案」) records outcome
# "wrong"; session/question stay nullable for non-quiz attributions.
class EvidenceRecord < ApplicationRecord
  belongs_to :user
  belongs_to :node, class_name: "KnowledgeNode"
  belongs_to :session, class_name: "QuizSession", optional: true
  belongs_to :question, optional: true

  enum :outcome, { correct: "correct", partial: "partial", wrong: "wrong" }, scopes: false
end
