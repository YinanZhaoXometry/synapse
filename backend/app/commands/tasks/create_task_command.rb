# frozen_string_literal: true

module Tasks
  # Create a study task (AD-6) — the Phase-1 task-repository createStudyTask
  # mirror (frontend/src/data/task-repository.ts): one Material, one
  # auto-created KnowledgeNode (planId null, taskId set — its mastery is that
  # node's), titled after the material, stageless, at order 0, and the
  # material back-linked to the task. The node, the task, and the back-fill
  # land in ONE transaction (ticket AC).
  #
  # The client-supplied task uuid is the idempotency key (AD-12; kickoff
  # delta 3): same-user replay → Success returning the existing rows (no-op);
  # the same id owned by a DIFFERENT user → VALIDATION_FAILED (ownership
  # verification — never silently link, FR-4).
  #
  # Deviation from Phase-1 (recorded in the ticket Comments): Phase-1
  # silently re-points material.taskId when the material is already being
  # studied by another task; the ER pins one task per material
  # (unique materials.task_id — "task_id mirrors the one task studying this
  # material"), so a re-point is refused VALIDATION_FAILED instead of
  # stranding the earlier task.
  class CreateTaskCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :material_id

    def call
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      # Idempotent replay: the uuid is addressed through the owner's scope,
      # so a foreign task never even reaches this branch as "existing".
      existing = current_user.study_tasks.find_by(id: client_uuid)
      return replay_success(existing) if existing

      # The uuid exists but is not this user's row — a create-time collision
      # is ownership verification, not a read: VALIDATION_FAILED per delta 3
      # (NOT_FOUND stays reserved for by-id addressing).
      return cross_user_uuid_failure if StudyTask.exists?(id: client_uuid)

      # The material is addressed through the owner's association path
      # (delta 2): unknown, foreign, and malformed ids are uniformly
      # NOT_FOUND — never reveals existence.
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      if material.task_id
        return Failure(:VALIDATION_FAILED,
                       { message: "material already belongs to a study task", field: :materialId })
      end

      task = nil
      node = nil
      ActiveRecord::Base.transaction do
        # The triangle is mutually referential (study_tasks.node_id NOT NULL,
        # knowledge_nodes.task_id → study_tasks): insert the node first with
        # task_id null, the task second, then back-fill both links — the
        # factory's insert dance, in command form.
        node = current_user.knowledge_nodes.create!(
          plan_id: nil, task_id: nil, title: material.title, stage: nil, order: 0
        )
        task = current_user.study_tasks.create!(id: client_uuid, material: material, node: node)
        node.update!(task_id: task.id)
        material.update!(task_id: task.id)
      end
      Success(task: task, node: node)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-checks and the INSERTs (same
      # backstop shape as Plans::PlanCreation's): whoever won the race is
      # either this user (replay → Success) or not (ownership failure); the
      # only other unique-index candidate is the material's task back-fill
      # lost to a concurrent tasking — decided by re-lookup, never by
      # trusting the race.
      existing = current_user.study_tasks.find_by(id: client_uuid)
      return replay_success(existing) if existing
      return cross_user_uuid_failure if StudyTask.exists?(id: client_uuid)

      Failure(:VALIDATION_FAILED,
              { message: "material already belongs to a study task", field: :materialId })
    end

    private

    def replay_success(task)
      Success(task: task, node: task.node)
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's task", field: :clientUuid })
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
