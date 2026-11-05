# frozen_string_literal: true

module Types
  # One mistake on the mistakesHub read model (FR-23, epic P2-09 T1, delta
  # decision 4): the flat entry with everything the mistakes hub needs to
  # render, group, filter, and deep-link — the question (prompt + source
  # material/section locators), the user's answer, the node/plan/task
  # context, and the sourceLocation ReadingLocator verbatim (AD-2). The
  # list itself is ordered newest-first server-side; grouping and filtering
  # are the web's rendering concerns (T2 decides).
  class HubMistakeEntryType < Types::BaseObject
    description "A mistake entry on the hub read model (FR-23): the wrong answer with its question, the user's answer, node/plan/task context, and the verbatim ReadingLocator source location."

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
          description: "The attributed node's uuid (follows the question's attribution, AD-6)."

    field :plan_id, String,
          null: true,
          description: "The plan the node belongs to (through the node; null on task-owned nodes)."

    field :task_id, String,
          null: true,
          description: "The task the node belongs to (through the node; null on plan nodes)."

    field :material_id, String,
          null: false,
          description: "The question's source material uuid — the deep-link target (FR-23)."

    field :user_answer, String,
          null: false,
          description: "What the user answered (empty for a forfeit)."

    field :source_location, Types::ReadingLocatorType,
          null: false,
          description: "Where in the sourced material the question came from (FR-23) — the ReadingLocator jsonb verbatim (AD-2: keys ride the wire untouched)."

    field :question, Types::QuestionType,
          null: false,
          description: "The mistaken question — its prompt and source material/section pair ride for the hub rows."

    field :forfeited, Boolean,
          null: false,
          description: "「看答案 = 放弃」: graded wrong, no mastery credit (FR-18)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the mistake was logged (server-set)."

    def plan_id
      node.plan_id
    end

    def task_id
      node.task_id
    end

    def material_id
      object.question.source_material_id
    end

    private

    def node
      object.node
    end
  end
end
