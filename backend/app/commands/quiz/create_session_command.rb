# frozen_string_literal: true

module Quiz
  # Create a quiz session with its node-attributed questions — the Phase-1
  # quiz-repository createQuizSession mirror
  # (frontend/src/data/quiz-repository.ts): the session and ALL of its
  # questions land in ONE transaction (ticket AC), every question carrying its
  # nodeId attribution stamped at generation time (AD-6 — required on every
  # input; targeted generation stays epic-10) and its materials-sourced
  # provenance (sourceMaterialId + sourceSectionId, FR-18/NFR-1).
  #
  # The client-supplied session uuid is the idempotency key (AD-12; kickoff
  # delta 3): same-user replay → Success returning the existing rows (the
  # replayed question payload is NOT re-applied); the same id owned by a
  # DIFFERENT user → VALIDATION_FAILED (ownership verification — never
  # silently link, FR-4).
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the ER's
  # exactly-one-owner law (quiz_sessions_exactly_one_owner_check) makes
  # planId/taskId an xor — Phase-1's TS type allows both null, the server
  # refuses both-neither and both-at-once; the nodeId and sourceMaterialId on
  # every question are ownership-checked addresses (delta 2 — foreign/unknown/
  # malformed → NOT_FOUND), where Phase-1 trusted the client's ids; and
  # choice-shape completeness (options + in-range correctOptionIndex) is
  # validated server-side where Phase-1 persisted whatever arrived.
  class CreateSessionCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :plan_id, optional: true
    option :task_id, optional: true
    option :mode
    option :questions

    def call
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
      validation = validate_inputs!
      return validation if validation

      # Idempotent replay (delta 3): the row is a no-op — the original
      # questions stand, whatever the replay carries.
      existing = current_user.quiz_sessions.find_by(id: client_uuid)
      return replay_success(existing) if existing

      # The uuid exists but is not this user's row — ownership verification,
      # not a read: VALIDATION_FAILED per delta 3.
      return cross_user_uuid_failure if QuizSession.exists?(id: client_uuid)

      plan = plan_scope
      return plan if plan.failure?

      task = task_scope
      return task if task.failure?

      # Per-question addresses are ownership-checked before anything is
      # written (delta 2): a foreign or unknown node/material is uniformly
      # NOT_FOUND, so a session can never anchor another user's rows.
      resolved = questions.map { |attrs| resolve_question(attrs) }
      return resolved.find(&:failure?) if resolved.any?(&:failure?)

      # User-owned is not enough (the epic P2-3 review, P2-5): every
      # question's node must also sit INSIDE the session's own scope, or a
      # plan-A session could attribute plan-B's nodes. Out-of-scope →
      # VALIDATION_FAILED, nothing written.
      scope_failure = out_of_scope_node(resolved, plan.value!, task.value!)
      return scope_failure if scope_failure

      session = nil
      created = nil
      ActiveRecord::Base.transaction do
        session = current_user.quiz_sessions.create!(
          id: client_uuid,
          plan_id: plan.value!&.id,
          task_id: task.value!&.id,
          mode: mode
        )
        created = resolved.map.with_index do |result, index|
          attrs = result.value!
          current_user.questions.create!(
            session: session,
            node: attrs[:node],
            kind: attrs[:kind],
            prompt: attrs[:prompt],
            options: attrs[:options],
            correct_option_index: attrs[:correct_option_index],
            source_material: attrs[:material],
            source_section_id: attrs[:source_section_id],
            keywords: attrs[:keywords],
            explanation: attrs[:explanation],
            # The generation order, ER-backed (the epic P2-3 review, P2-3 —
            # the uuid tie-break on (created_at, id) is not insertion order).
            position: index
          )
        end
      end
      Success(session: session, questions: created)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-check and the INSERT (same
      # backstop shape as Plans::PlanCreation's): whoever won the race is
      # either this user (replay → Success) or not (ownership failure).
      existing = current_user.quiz_sessions.find_by(id: client_uuid)
      existing ? replay_success(existing) : cross_user_uuid_failure
    end

    private

    # Shape-level validation (payload rules), resolved addresses (scope ids,
    # per-question node/material) happen after the replay check.
    def validate_inputs!
      unless Quiz::MODES.include?(mode.to_s)
        return Failure(:VALIDATION_FAILED, { message: "mode is invalid", field: :mode })
      end
      if plan_id.present? && task_id.present?
        return Failure(:VALIDATION_FAILED,
                       { message: "scope a quiz session by plan or task, not both", field: :planId })
      end
      if plan_id.blank? && task_id.blank?
        return Failure(:VALIDATION_FAILED,
                       { message: "a quiz session needs a plan or a task scope", field: :planId })
      end
      if questions.empty?
        return Failure(:VALIDATION_FAILED,
                       { message: "a quiz session needs at least one question", field: :questions })
      end

      questions.each do |attrs|
        failure = validate_question_shape!(attrs)
        return failure if failure
      end
      nil
    end

    def validate_question_shape!(attrs)
      unless Quiz::QUESTION_KINDS.include?(attrs[:kind].to_s)
        return Failure(:VALIDATION_FAILED, { message: "question kind is invalid", field: :questions })
      end
      if attrs[:prompt].to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "question prompt is required", field: :questions })
      end
      if attrs[:explanation].to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "question explanation is required", field: :questions })
      end
      if attrs[:source_section_id].to_s.strip.empty?
        return Failure(:VALIDATION_FAILED,
                       { message: "question source section id is required (the provenance chain, FR-18)",
                         field: :questions })
      end

      choice_shape_failure(attrs)
    end

    # A choice question carries usable options and an in-range index; an open
    # question's choice-only fields are normalized away (not persisted).
    def choice_shape_failure(attrs)
      return unless attrs[:kind] == "choice"

      options = attrs[:options]
      if options.blank? || options.length < 2
        return Failure(:VALIDATION_FAILED,
                       { message: "a choice question needs at least two options", field: :questions })
      end
      index = attrs[:correct_option_index]
      unless index.is_a?(Integer) && index >= 0 && index < options.length
        return Failure(:VALIDATION_FAILED,
                       { message: "correct option index is out of range", field: :questions })
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

    def task_scope
      return Success(nil) unless task_id

      unless task_id.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "task not found" })
      end
      task = current_user.study_tasks.find_by(id: task_id)
      task ? Success(task) : Failure(:NOT_FOUND, { message: "task not found" })
    end

    # Resolves one question's addresses (node + source material) and its
    # normalized column shape. Returns Success(attrs-with-records) or a typed
    # NOT_FOUND failure.
    def resolve_question(attrs)
      node = addressed_node(attrs[:node_id])
      return node if node.failure?

      material = addressed_material(attrs[:source_material_id])
      return material if material.failure?

      normalized = {
        node: node.value!,
        material: material.value!,
        kind: attrs[:kind],
        prompt: attrs[:prompt],
        source_section_id: attrs[:source_section_id],
        keywords: attrs[:keywords],
        explanation: attrs[:explanation]
      }
      if attrs[:kind] == "choice"
        normalized[:options] = attrs[:options]
        normalized[:correct_option_index] = attrs[:correct_option_index]
      end
      Success(normalized)
    end

    def addressed_node(node_id)
      return node_not_found unless node_id.to_s.match?(Accounts::UUID_REGEX)

      node = current_user.knowledge_nodes.find_by(id: node_id)
      node ? Success(node) : node_not_found
    end

    def addressed_material(material_id)
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      material ? Success(material) : material_not_found
    end

    # The session scope bounds the attribution (P2-5): a plan-scoped session
    # may only attribute that plan's nodes; a task-scoped session only the
    # task's single auto-node.
    def out_of_scope_node(resolved, plan_record, task_record)
      offender = resolved.find do |result|
        node = result.value![:node]
        plan_record ? node.plan_id != plan_record.id : node.id != task_record.node_id
      end
      return unless offender

      Failure(:VALIDATION_FAILED,
              { message: "a question attributes a node outside the session's scope",
                field: :questions })
    end

    def replay_success(session)
      Success(session: session, questions: session.questions.order(:position, :created_at, :id))
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's quiz session", field: :clientUuid })
    end

    def node_not_found
      Failure(:NOT_FOUND, { message: "node not found" })
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
