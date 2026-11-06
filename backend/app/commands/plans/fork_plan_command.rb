# frozen_string_literal: true

module Plans
  # Fork a Square plan into the adopter's own library (FR-39 web half, OQ-12,
  # epic P2-11 T3 — delta decisions 4+5): the AUTHENTICATED adopt command.
  # The source resolves ONLY through StudyPlan.publicly_visible (the T2
  # public-read convention — a private/foreign/unknown/malformed source id
  # answers the uniform NOT_FOUND; no existence leak). STRUCTURE ONLY is
  # copied into a new plan owned by current_user: topic + goal verbatim, the
  # nodes' title/stage/order verbatim (order is the source's stored key, not
  # re-derived from the copy position) plus the roadmap metadata
  # (description/optional, epic-16 T1 — structure now includes it); the
  # adopter's copy starts PRIVATE — publishing it is theirs alone (FR-38).
  # The source's prerequisite edges copy alongside the nodes, remapped onto
  # the fork's own node ids by source position (epic-16 T1: the copy stays
  # faithful to the source structure — user story 11). The attribution row
  # lands in the same transaction: forked_from_plan_id (FK SET NULL — the
  # source's deletion never breaks the fork) + forked_from_topic (the
  # fork-time snapshot, delta decision 4). Materials/annotations/evidence/
  # mappings/markings/progress are never touched on either side: nothing
  # writes back to the source, nothing carries over.
  #
  # The pinned empty-source ruling (recorded 2026-11-05): a ZERO-NODE source
  # refuses the fork with VALIDATION_FAILED — adopting an empty shell is
  # meaningless, and the Square listing already shows node counts, so the
  # refusal is visible before the click.
  #
  # Idempotency (delta 3, verbatim — the sixth idempotent create command,
  # hand-copied per the ticket's mirror-PlanCreation instruction; the
  # extract-a-concern counter now reads six): same-user replay with the same
  # client uuid → Success returning the existing fork (BEFORE source
  # resolution, so a replay answers even after the source flips private);
  # the uuid owned by a DIFFERENT user → VALIDATION_FAILED (never silently
  # link, FR-4); a non-uuid → shape refusal.
  class ForkPlanCommand < ApplicationCommand
    option :current_user
    option :source_plan_id
    option :client_uuid

    def call
      return client_uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      # Idempotent replay first (the delta-3 posture): the uuid is addressed
      # through the owner's scope, so a foreign plan never reaches this
      # branch as "existing".
      existing = current_user.study_plans.find_by(id: client_uuid)
      return replay_success(existing) if existing

      # A create-time collision is ownership verification, not a read:
      # VALIDATION_FAILED per delta 3 (NOT_FOUND stays reserved for by-id
      # addressing).
      return cross_user_uuid_failure if StudyPlan.exists?(id: client_uuid)

      source = public_source
      return not_found unless source

      source_nodes = source.knowledge_nodes.order(:order)
      if source_nodes.empty?
        return Failure(:VALIDATION_FAILED,
                       { message: "an empty plan cannot be forked", field: :sourcePlanId })
      end

      plan = nil
      nodes = nil
      ActiveRecord::Base.transaction do
        plan = current_user.study_plans.create!(
          id: client_uuid,
          topic: source.topic,
          goal: source.goal,
          visibility: "private",
          forked_from_plan_id: source.id,
          forked_from_topic: source.topic
        )
        nodes = source_nodes.map do |node|
          current_user.knowledge_nodes.create!(
            plan: plan, title: node.title, stage: node.stage, order: node.order,
            description: node.description, optional: node.optional
          )
        end
        copy_plan_edges(source, plan, source_nodes, nodes)
      end
      Success(plan: plan, nodes: nodes)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-check and the INSERT (the
      # PlanCreation backstop shape): whoever won the race is either this
      # user (replay → Success) or not (ownership failure) — decided by a
      # scoped re-lookup, never by trusting the race.
      existing = current_user.study_plans.find_by(id: client_uuid)
      existing ? replay_success(existing) : cross_user_uuid_failure
    end

    private

    # The source's edges, remapped onto the fork's own nodes by source
    # position (both lists are order-sorted, so position ↔ position). The
    # source's stored edges are already valid for the copied stages — they
    # copy verbatim, no re-validation (faithful structure, not a re-derive).
    def copy_plan_edges(source, plan, source_nodes, forked_nodes)
      new_by_old = source_nodes.zip(forked_nodes).to_h { |old, fresh| [old.id, fresh] }
      source.knowledge_node_edges.order(:created_at, :id).each do |edge|
        from = new_by_old[edge.from_node_id]
        to = new_by_old[edge.to_node_id]
        next if from.nil? || to.nil?

        plan.knowledge_node_edges.create!(user_id: plan.user_id, from_node: from, to_node: to)
      end
    end

    # The stricter public-path addressing (the P2-4 review posture): the
    # source answers only through the explicit publicly_visible scope, after
    # the malformed-address guard (a malformed id must not become a 500 from
    # the uuid column comparison — the house `plan` posture). Private,
    # foreign, unknown, and malformed ids all yield nil here and answer the
    # SAME NOT_FOUND.
    def public_source
      return nil unless source_plan_id.to_s.match?(Accounts::UUID_REGEX)

      StudyPlan.publicly_visible.find_by(id: source_plan_id)
    end

    def not_found
      Failure(:NOT_FOUND, { message: "plan not found" })
    end

    def client_uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def replay_success(plan)
      Success(plan: plan, nodes: plan.knowledge_nodes.order(:order))
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's plan", field: :clientUuid })
    end
  end
end
