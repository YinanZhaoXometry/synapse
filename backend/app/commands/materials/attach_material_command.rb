# frozen_string_literal: true

module Materials
  # Attach a material — the Phase-1 material-repository registerMaterial
  # mirror (frontend/src/data/material-repository.ts): metadata, the
  # client-extracted sections, and the parse state, with file bytes
  # explicitly absent (they never reach the api — AD-7 client-side parsing,
  # AD-13 extracted text in Postgres, bytes are epic-06). The client uuid is
  # the idempotency key (AD-12; kickoff delta 3): re-upload safe — same-user
  # replay returns the existing row untouched; a uuid owned by a DIFFERENT
  # user → VALIDATION_FAILED (never silently link, FR-4).
  #
  # The parse state defaults per Phase-1's derivation: no parseState given →
  # "parsed" when sections were extracted, "pending" otherwise. A
  # parseFailureReason is only meaningful while the state is "failed" (the
  # TS shape: "Set only while parseState is failed") — carried on attach too,
  # so a re-upload of an already-failed parse can state the reason.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): sections are
  # validated, not truncated (delta 6's 100,000-char cap → VALIDATION_FAILED
  # beyond); the planId/taskId scope ids are ownership-checked addresses
  # (foreign/unknown → NOT_FOUND per delta 2), where Phase-1 trusted the
  # client's ids; and the one-task-per-material invariant is enforced
  # instead of Phase-1's silent task_id re-point.
  class AttachMaterialCommand < ApplicationCommand
    include SectionValidation

    option :current_user
    option :client_uuid
    option :title
    option :kind
    option :size_bytes
    option :plan_id, optional: true
    option :task_id, optional: true
    option :sections
    option :parse_state, optional: true
    option :parse_failure_reason, optional: true

    def call
      validation = validate_inputs!
      return validation if validation

      # Idempotent replay (delta 3): the row is a no-op — the original
      # payload stands, whatever the replay carries.
      existing = current_user.materials.find_by(id: client_uuid)
      return Success(material: existing) if existing

      # The uuid exists but is not this user's row — ownership verification,
      # not a read: VALIDATION_FAILED per delta 3.
      return cross_user_uuid_failure if Material.exists?(id: client_uuid)

      plan = plan_scope
      return plan if plan.failure?

      task = task_scope
      return task if task.failure?

      material = current_user.materials.create!(
        id: client_uuid,
        title: title,
        kind: kind,
        size_bytes: size_bytes,
        plan_id: plan.value!&.id,
        task_id: task.value!&.id,
        parse_state: parse_state || (sections.any? ? "parsed" : "pending"),
        parse_failure_reason: parse_state == "failed" ? parse_failure_reason : nil,
        sections: sections_as_jsonb(sections)
      )
      Success(material: material)
    rescue ActiveRecord::RecordNotUnique
      # Two distinct race candidates can land here (the epic P2-3 review,
      # P2-1) — decided by re-lookup, never by trusting the exception (the
      # Tasks::CreateTaskCommand rescue pattern):
      # 1. the PK race between the pre-check and the INSERT: whoever won is
      #    either this user (replay → Success) or another user (ownership
      #    failure);
      # 2. the materials.task_id unique-index race — a concurrent twin
      #    tasking the same material won the back-fill between task_scope's
      #    check and the INSERT → the task-conflict answer, not the
      #    cross-user one.
      existing = current_user.materials.find_by(id: client_uuid)
      return Success(material: existing) if existing
      return cross_user_uuid_failure if Material.exists?(id: client_uuid)

      Failure(:VALIDATION_FAILED,
              { message: "the task already studies another material", field: :taskId })
    end

    private

    def validate_inputs!
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
      if title.to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "title is required", field: :title })
      end
      unless Material.kinds.key?(kind.to_s)
        return Failure(:VALIDATION_FAILED, { message: "kind is invalid", field: :kind })
      end
      if parse_state && !Material.parse_states.key?(parse_state.to_s)
        return Failure(:VALIDATION_FAILED, { message: "parse state is invalid", field: :parseState })
      end
      reason_failure = parse_failure_reason_validation
      return reason_failure if reason_failure

      validate_sections!(sections)
    end

    def parse_failure_reason_validation
      return unless parse_failure_reason

      unless Material.parse_failure_reasons.key?(parse_failure_reason.to_s)
        return Failure(:VALIDATION_FAILED,
                       { message: "parse failure reason is invalid", field: :parseFailureReason })
      end
      if parse_state != "failed"
        return Failure(:VALIDATION_FAILED,
                       { message: "parse failure reason is only set while the parse state is failed",
                         field: :parseFailureReason })
      end
      nil
    end

    # The plan scope is an ownership-checked address (delta 2): unknown,
    # foreign, and malformed ids are uniformly NOT_FOUND.
    def plan_scope
      return Success(nil) unless plan_id

      unless plan_id.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "plan not found" })
      end
      plan = current_user.study_plans.find_by(id: plan_id)
      plan ? Success(plan) : Failure(:NOT_FOUND, { message: "plan not found" })
    end

    # Same for the task scope — plus the one-task-per-material invariant
    # (unique materials.task_id): a task always already studies its material
    # (tasks are born with it), so naming a live task can only conflict.
    def task_scope
      return Success(nil) unless task_id

      unless task_id.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "task not found" })
      end
      task = current_user.study_tasks.find_by(id: task_id)
      return Failure(:NOT_FOUND, { message: "task not found" }) unless task
      if current_user.materials.where(task_id: task.id).exists?
        return Failure(:VALIDATION_FAILED,
                       { message: "the task already studies another material", field: :taskId })
      end

      Success(task)
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's material", field: :clientUuid })
    end
  end
end
