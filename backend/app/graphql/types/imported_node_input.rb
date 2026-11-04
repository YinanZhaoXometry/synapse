# frozen_string_literal: true

module Types
  # One knowledge node of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4). taskId is set only on a Study Task's auto-owned node — it must
  # name a task carried by the same document (the triangle travels whole).
  class ImportedNodeInput < Types::BaseInputObject
    description "One knowledge node of a document being imported (Phase-1 KnowledgeNode)."

    argument :id, String,
             required: true,
             description: "The node's client uuid (AD-12) — its key in the idempotent import."

    argument :title, String,
             required: true,
             description: "The node's title."

    argument :stage, String,
             required: false,
             description: "The stage grouping (nullable)."

    argument :order, Int,
             required: true,
             description: "Position within the plan's node tree (the Phase-1 field, verbatim)."

    argument :plan_id, String,
             required: false,
             description: "The owning plan's uuid (null on a task-owned node, AD-6)."

    argument :task_id, String,
             required: false,
             description: "The owning Study Task's uuid — must name a task of the same document."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the node was created on the client."
  end
end
