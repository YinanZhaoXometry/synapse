# frozen_string_literal: true

module Types
  # The only unit that moves a Mastery Score (GLOSSARY): one graded quiz
  # answer, node-attributed (AD-6). The Phase-1 TS EvidenceRecord shape
  # verbatim: id/nodeId/sessionId/questionId/outcome/createdAt. A forfeit
  # 「看答案」 is recorded as outcome "wrong" (no mastery credit, FR-18). The
  # 1/0.5/0 scoring over these records is epic-04's (AD-14) — nothing here
  # computes a score.
  class EvidenceRecordType < Types::BaseObject
    description "One graded quiz answer, node-attributed — the only unit that moves a Mastery Score (a forfeit grades as wrong)."

    field :id, String,
          null: false,
          description: "The evidence record's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :node_id, String,
          null: false,
          description: "The evidenced node's uuid (AD-6 — read off the question at write time)."

    field :session_id, String,
          null: true,
          description: "The grading session's uuid (null for non-quiz attributions)."

    field :question_id, String,
          null: true,
          description: "The answered question's uuid (null for non-quiz attributions)."

    field :outcome, String,
          null: false,
          description: "\"correct\" | \"partial\" | \"wrong\" (ADR-0001's evidence vocabulary; a forfeit is wrong)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the answer was recorded (server-set)."
  end
end
