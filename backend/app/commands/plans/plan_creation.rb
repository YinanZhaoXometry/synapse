# frozen_string_literal: true

module Plans
  # Shared creation core for the two plan-creation commands
  # (CreatePlanCommand + ConfirmProposalCommand): input validation, the
  # kickoff delta-3 idempotency rule, and the ONE transaction that lands
  # the plan and its nodes together (ticket AC). Mixed in as instance
  # methods so both commands run one code path — and can use the
  # ApplicationCommand Failure factory directly.
  #
  # Idempotency (delta 3, verbatim): same-user replay with the same client
  # uuid → Success returning the existing rows (no-op); the same id owned by
  # a DIFFERENT user → VALIDATION_FAILED (ownership verification — never
  # silently link, FR-4).
  module PlanCreation
    # Returns the command Result. Kept public (commands delegate to it from #call).
    def create_plan_with_nodes(current_user:, client_uuid:, topic:, goal:, visibility:, nodes_attrs:)
      validation = validate_creation_inputs!(
        client_uuid: client_uuid, topic: topic, visibility: visibility, nodes_attrs: nodes_attrs
      )
      return validation if validation

      # Idempotent replay: the uuid is addressed through the owner's scope,
      # so a foreign plan never even reaches this branch as "existing".
      existing = current_user.study_plans.find_by(id: client_uuid)
      return replay_success(existing) if existing

      # The uuid exists but is not this user's row — a create-time collision
      # is ownership verification, not a read: VALIDATION_FAILED per delta 3
      # (NOT_FOUND stays reserved for by-id addressing).
      return cross_user_uuid_failure if StudyPlan.exists?(id: client_uuid)

      plan = nil
      nodes = nil
      ActiveRecord::Base.transaction do
        plan = current_user.study_plans.create!(
          id: client_uuid,
          topic: topic,
          goal: goal,
          visibility: visibility || Plans::DEFAULT_VISIBILITY
        )
        # Phase-1 createPlan derives order from the input position — mirrored.
        nodes = nodes_attrs.map.with_index do |attrs, index|
          current_user.knowledge_nodes.create!(
            plan: plan, title: attrs[:title], stage: attrs[:stage], order: index
          )
        end
      end
      Success(plan: plan, nodes: nodes)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-check and the INSERT (same backstop
      # shape as Accounts::RegisterUserCommand's duplicate email): whoever won
      # the race is either this user (replay → Success) or not (ownership
      # failure) — decided by a scoped re-lookup, never by trusting the race.
      existing = current_user.study_plans.find_by(id: client_uuid)
      existing ? replay_success(existing) : cross_user_uuid_failure
    end

    private

    def replay_success(plan)
      Success(plan: plan, nodes: ordered_nodes(plan))
    end

    def ordered_nodes(plan)
      plan.knowledge_nodes.order(:order)
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's plan", field: :clientUuid })
    end

    # Command-side validation (epic-01's minimal-model posture): every rule
    # returns the first typed Failure, or nil when the inputs are clean.
    def validate_creation_inputs!(client_uuid:, topic:, visibility:, nodes_attrs:)
      unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
      end
      if topic.to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "topic is required", field: :topic })
      end
      if nodes_attrs.empty?
        return Failure(:VALIDATION_FAILED, { message: "a plan needs at least one node", field: :nodes })
      end
      if nodes_attrs.any? { |attrs| attrs[:title].to_s.strip.empty? }
        return Failure(:VALIDATION_FAILED, { message: "node title is required", field: :nodes })
      end
      unless Plans::VISIBILITIES.include?(visibility || Plans::DEFAULT_VISIBILITY)
        return Failure(:VALIDATION_FAILED, { message: "visibility is invalid", field: :visibility })
      end
      nil
    end
  end
end
