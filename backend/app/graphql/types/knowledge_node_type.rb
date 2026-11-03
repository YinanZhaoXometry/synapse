# frozen_string_literal: true

module Types
  # A plan's structural unit, or a Study Task's single auto-created node
  # (AD-6 — planId and taskId are mutually exclusive, exactly one set). The
  # wire shape mirrors the Phase-1 TS KnowledgeNode
  # (frontend/src/domain/entities.ts): id/planId/taskId/stage/title/order
  # verbatim, plus createdAt (the server row's timestamp — the TS shape has
  # none; deviation recorded in the ticket Comments).
  class KnowledgeNodeType < Types::BaseObject
    description "A knowledge node: a plan's structural unit or a Study Task's owned node (AD-6)."

    field :id, String,
          null: false,
          description: "The node's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :plan_id, String,
          null: true,
          description: "The owning plan's uuid (null on a task-owned node, AD-6)."

    field :task_id, String,
          null: true,
          description: "The owning Study Task's uuid (null on a plan node, AD-6)."

    field :stage, String,
          null: true,
          description: "The stage grouping from the plan structure (e.g. 基础/核心/进阶/应用)."

    field :title, String,
          null: false,
          description: "The node's title."

    field :order, Int,
          null: false,
          description: "Position within the plan's node tree (the Phase-1 TS field name, verbatim)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the node was created."
  end
end
