# frozen_string_literal: true

module Types
  # One node row on the analyticsSeries read model (FR-26, epic P2-09 T1,
  # delta decision 4): the node's mastery through the ONE scorer (Mastery,
  # freshness engaged — identical semantics to the KnowledgeNodeType fields,
  # AD-14/AD-6). masteryScore rides as a String carrying the integer percent
  # — the wire's established convention.
  class NodeMasteryEntryType < Types::BaseObject
    description "One node's mastery on the analytics series (FR-26): computed by the api's Mastery module, the client renders, never recomputes (AD-14)."

    field :node_id, String,
          null: false,
          description: "The node's uuid."

    field :node_title, String,
          null: false,
          description: "The node's title."

    field :plan_id, String,
          null: true,
          description: "The owning plan's uuid (null on task-owned nodes)."

    field :mastery_score, String,
          null: false,
          description: "The Mastery Score (ADR-0001) as a string carrying the integer percent \"0\"..\"100\" — freshness engaged (a node whose latest evidence is more than 14 days old caps at \"99\")."

    field :state, String,
          null: false,
          description: "\"uncovered\" | \"partial\" | \"mastered\" — Mastery's node-state vocabulary verbatim (AD-6)."

    # The read model row carries the raw integer (Mastery's exact value); the
    # wire convention is the String-carrying-the-percent (KnowledgeNodeType).
    def mastery_score
      object.score.to_s
    end
  end
end
