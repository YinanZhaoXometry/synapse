# frozen_string_literal: true

module Types
  # A logged wrong answer (FR-23: every mistake carries its source location) —
  # the Phase-1 TS MistakeEntry shape verbatim: id/questionId/sessionId/nodeId/
  # userAnswer/sourceLocation/forfeited/createdAt. A forfeit 「看答案 = 放弃」
  # is graded wrong with its flag set — no mastery credit (FR-18). Phase 1
  # exposes no mistake READ (the document's mistakes array has no repository
  # reader); the type is reachable through the RecordEvidence payload's
  # mistakes field — the rows that grade just auto-logged (deviation recorded
  # in the ticket Comments).
  class MistakeEntryType < Types::BaseObject
    description "A logged wrong answer with its source location (FR-23); forfeited marks the 「看答案」 give-up."

    field :id, String,
          null: false,
          description: "The mistake entry's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :question_id, String,
          null: false,
          description: "The answered question's uuid."

    field :session_id, String,
          null: true,
          description: "The grading session's uuid (null for non-quiz attributions)."

    field :node_id, String,
          null: false,
          description: "The attributed node's uuid (follows the question's attribution)."

    field :user_answer, String,
          null: false,
          description: "What the user answered (empty for a forfeit)."

    field :question, Types::QuestionType,
          null: false,
          description: "The mistaken question (FR-46, epic P2-12 T3: its prompt + source pair ride the plan companion's mistake picker rows)."

    field :source_location, Types::ReadingLocatorType,
          null: false,
          description: "Where in the sourced material the question came from (FR-23)."

    field :forfeited, Boolean,
          null: false,
          description: "「看答案 = 放弃」: graded wrong, no mastery credit (FR-18)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the mistake was logged (server-set)."
  end
end
