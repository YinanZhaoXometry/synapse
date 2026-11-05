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

    # The promotion pointer (FR-37 stretch half, epic-14 T2): non-null id ⇔
    # promoted — the state is INFERRED from the pointer (delta decision 4),
    # never a boolean. A promoted task is read-only: its content (the node +
    # material) moved into the plan; the page renders the pointer.
    field :promoted_plan_id, String,
          null: true,
          description: "The study plan this task was promoted into (FR-37 stretch) — null while the task is plan-free. The promoted state is inferred from this pointer."

    field :promoted_at, Types::DateTime,
          null: true,
          description: "When the promotion happened — set exactly with promotedPlanId."

    field :promoted_plan, Types::StudyPlanType,
          null: true,
          description: "The promoted-into plan, readable directly (the pointer card's deep-link target) — null while the task is plan-free."

    field :node, Types::KnowledgeNodeType,
          null: false,
          description: "The task's single auto-owned node (AD-6 — the getTaskNode mirror; always exists, created with the task). After promotion the node still rides the task (its stable id — evidence continuity) but lives in the promoted plan (planId set, taskId cleared)."
  end
end
