# frozen_string_literal: true

module Types
  # One study task of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4/AD-6 — one material, one auto-owned node). Both references must
  # name rows carried by the same document (the Phase-1 snapshot always
  # travels whole).
  class ImportedTaskInput < Types::BaseInputObject
    description "One study task of a document being imported (Phase-1 StudyTask)."

    argument :id, String,
             required: true,
             description: "The task's client uuid (AD-12) — its key in the idempotent import."

    argument :material_id, String,
             required: true,
             description: "The studied material's uuid — must name a material of the same document."

    argument :node_id, String,
             required: true,
             description: "The task's auto-owned node's uuid — must name a node of the same document."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the task was created on the client."
  end
end
