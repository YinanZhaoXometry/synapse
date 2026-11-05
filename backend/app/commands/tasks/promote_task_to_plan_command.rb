# frozen_string_literal: true

module Tasks
  # Promote a Study Task into a Study Plan (FR-37 stretch half, epic-14 T2;
  # delta decision 4) — the outgrowth path: the task's single-document study
  # became a plan-shaped effort, so the content moves without losing a byte
  # of history. ONE transaction (AD-12):
  #
  # - a new StudyPlan is created (the caller's, private, goal null);
  # - the task's single auto-node KEEPS ITS ID and gains plan_id (task_id
  #   nulled per AD-6 — a node is plan-or-task, never both; the schema pins
  #   it by convention only, the command enforces it);
  # - the material re-points to the plan (task_id cleared, plan_id set); its
  #   attachment_scope stays untouched — task materials are created scope
  #   "plan" (AttachMaterialCommand's default + the task-triangle pin
  #   rejection), so the plan-scope assembly includes it as-is;
  # - the task row becomes a READ-ONLY POINTER: promoted_plan_id +
  #   promoted_at set (promoted state INFERRED from the non-null id), while
  #   node_id/material_id stay — the stable ids that make evidence carry
  #   over untouched (score continuity by construction: the same node, the
  #   same records, the same Mastery result);
  # - the task's quiz sessions stay task-scoped (the task row survives, so
  #   they remain loadable — only NEW study continues on the plan).
  #
  # The plan topic defaults to the material's title — StudyTask carries no
  # title of its own (the task's displayed title IS the material's).
  #
  # Idempotency, both levels: same-uuid replay → Success with the promoted
  # plan (delta 3); an ALREADY-PROMOTED task → Success with the existing
  # pointer whatever uuid rides (nothing is created, so the task-level fact
  # wins). A client uuid owned by a DIFFERENT user → VALIDATION_FAILED
  # (ownership verification — never silently link, FR-4). The task address is
  # by-id: unknown/foreign/malformed → uniform NOT_FOUND (delta 2).
  class PromoteTaskToPlanCommand < ApplicationCommand
    option :current_user
    option :task_id
    option :client_uuid
    option :topic, optional: true

    def call
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      # By-id addressing through the owner's scope (delta 2): unknown,
      # foreign, and malformed ids are uniformly NOT_FOUND.
      return task_not_found unless task_id.to_s.match?(Accounts::UUID_REGEX)
      task = current_user.study_tasks.find_by(id: task_id)
      return task_not_found unless task

      # Task-level idempotency: a promoted task IS promoted — the existing
      # pointer is the answer (the "promote" click on a pointer card replays,
      # never double-creates).
      if task.promoted_plan_id
        return Success(plan: task.promoted_plan, task: task, node: task.node)
      end

      # The create-side uuid is ownership-verified before anything is written
      # (delta 3 — NOT_FOUND stays reserved for by-id addressing).
      return cross_user_uuid_failure if StudyPlan.exists?(id: client_uuid)

      # Nothing to promote (defensive against schema drift — the columns are
      # NOT NULL, so a well-formed row always carries both; a task that lost
      # either has no content the promotion could move).
      return Failure(:VALIDATION_FAILED,
                     { message: "the task has no node or material to promote", field: :taskId }) if task.node.nil? || task.material.nil?

      plan_topic = topic.presence || task.material.title
      if plan_topic.blank?
        return Failure(:VALIDATION_FAILED, { message: "topic is required", field: :topic })
      end

      plan = nil
      ActiveRecord::Base.transaction do
        plan = current_user.study_plans.create!(
          id: client_uuid,
          topic: plan_topic,
          goal: nil,
          visibility: "private"
        )
        # The xor flip (AD-6): the node's id is STABLE — only its plan/task
        # linkage changes. Evidence rides node_id, so scores carry over
        # untouched.
        task.node.update!(plan_id: plan.id, task_id: nil)
        # The material re-points plan-wide; attachment_scope stays what task
        # attach set ("plan" — see the header note).
        task.material.update!(plan_id: plan.id, task_id: nil)
        task.update!(promoted_plan_id: plan.id, promoted_at: Time.current)
      end
      Success(plan: plan, task: task.reload, node: task.node)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-checks and the INSERT (the
      # Plans::PlanCreation backstop shape): whoever won the race on this
      # uuid is either this user (replay → Success) or not (ownership
      # failure) — decided by re-lookup, never by trusting the exception.
      existing_plan = current_user.study_plans.find_by(id: client_uuid)
      return Success(plan: existing_plan, task: task, node: task.node) if existing_plan
      return cross_user_uuid_failure if StudyPlan.exists?(id: client_uuid)

      Failure(:VALIDATION_FAILED, { message: "client uuid already belongs to another row", field: :clientUuid })
    end

    private

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's plan", field: :clientUuid })
    end

    def task_not_found
      Failure(:NOT_FOUND, { message: "task not found" })
    end
  end
end
