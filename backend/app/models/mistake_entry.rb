# frozen_string_literal: true

# Every wrong answer, with its source location (FR-23). source_location is the
# ReadingLocator jsonb verbatim ({kind:"pdf",page} | {kind:"markdown",sectionId},
# AD-2). forfeited = 「看答案 = 放弃」: graded wrong, no mastery credit (FR-18).
class MistakeEntry < ApplicationRecord
  belongs_to :user
  belongs_to :question
  belongs_to :node, class_name: "KnowledgeNode"
  belongs_to :session, class_name: "QuizSession", optional: true
end
