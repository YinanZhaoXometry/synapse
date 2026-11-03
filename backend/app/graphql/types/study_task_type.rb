# frozen_string_literal: true

module Types
  # A plan-free single-document study task (AD-6): owns exactly one Material
  # and one auto-created KnowledgeNode — its mastery is that node's. The wire
  # shape mirrors the Phase-1 TS StudyTask (frontend/src/domain/entities.ts):
  # id/materialId/nodeId verbatim, plus createdAt (the server row's
  # timestamp — the TS shape has none; deviation recorded in the ticket
  # Comments). The `node` field is the getTaskNode mirror
  # (frontend/src/data/task-repository.ts): the task's owned node is
  # otherwise unreachable by id, since nodes ride the plan detail's tree.
  class StudyTaskType < Types::BaseObject
    description "A plan-free study task (AD-6): one material, one auto-owned node — its mastery is that node's."

    field :id, String,
          null: false,
          description: "The task's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :material_id, String,
          null: false,
          description: "The studied material's uuid."

    field :node_id, String,
          null: false,
          description: "The task's single auto-created node's uuid (AD-6)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the task was created."

    field :node, Types::KnowledgeNodeType,
          null: false,
          description: "The task's single auto-owned node (AD-6 — the getTaskNode mirror; always exists, created with the task)."
  end
end
