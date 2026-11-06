# frozen_string_literal: true

module Plans
  # Shared creation core for the two plan-creation commands
  # (CreatePlanCommand + ConfirmProposalCommand): input validation, the
  # kickoff delta-3 idempotency rule, and the ONE transaction that lands
  # the plan, its nodes, and its prerequisite edges together (ticket AC;
  # edges epic-16 T1). Mixed in as instance methods so both commands run
  # one code path — and can use the ApplicationCommand Failure factory
  # directly.
  #
  # Idempotency (delta 3, verbatim): same-user replay with the same client
  # uuid → Success returning the existing rows (no-op); the same id owned by
  # a DIFFERENT user → VALIDATION_FAILED (ownership verification — never
  # silently link, FR-4).
  #
  # Edges (epic-16 T1, FR-5 data half): `edge_pairs` arrives as [from,
  # to] POSITION pairs over `nodes_attrs` (each command resolves its own
  # edge vocabulary — id pairs on createPlan, title pairs on confirm — to
  # positions). Validity is stage-forward (the source's stage index strictly
  # below the target's, stages first-appearance-indexed in node order —
  # cycles impossible by construction), endpoints must be member nodes, and
  # [from, to] dedupes. An invalid edge DEGRADES: dropped silently-but-
  # logged, creation never blocked (AD-12's closed error enum — no new
  # error values).
  #
  # Client-supplied node ids (epic-16's edge addressing) follow the AD-12
  # id-supply law: a malformed/repeated id (or one colliding with the plan
  # uuid) is a typed shape refusal; an id owned by a DIFFERENT user fails
  # ownership verification (nothing created — never silently link, FR-4); a
  # same-user conflict skips that node (retry-safe, the row stays
  # untouched) exactly as the import treats owned rows.
  module PlanCreation
    # Returns the command Result. Kept public (commands delegate to it from #call).
    def create_plan_with_nodes(current_user:, client_uuid:, topic:, goal:, visibility:, nodes_attrs:, edge_pairs: [])
      validation = validate_creation_inputs!(
        client_uuid: client_uuid, topic: topic, visibility: visibility, nodes_attrs: nodes_attrs
      )
      return validation if validation
      if nodes_attrs.any? { |attrs| attrs[:id].present? } && (failure = node_id_failure(client_uuid, nodes_attrs))
        return failure
      end

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
        # A same-user-conflicting client id skips its position (the existing
        # row stays untouched), so the plan simply carries the other nodes.
        skipped = skipped_node_positions(nodes_attrs, current_user)
        nodes = nodes_attrs.map.with_index do |attrs, index|
          next if skipped.include?(index)

          node_attrs = {
            plan: plan, title: attrs[:title], stage: attrs[:stage], order: index,
            description: attrs[:description].to_s.strip.presence,
            optional: attrs[:optional] == true
          }
          node_attrs[:id] = attrs[:id] if attrs[:id].present?
          current_user.knowledge_nodes.create!(**node_attrs)
        end.compact
        build_plan_edges(plan, nodes, edge_pairs)
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

    # The client-supplied node id pre-scan (AD-12 id-supply law, see the
    # module comment): the first typed Failure, or nil when every supplied
    # id is clean (malformed/repeated/plan-colliding → shape refusal;
    # foreign-owned → ownership verification).
    def node_id_failure(client_uuid, nodes_attrs)
      supplied = nodes_attrs.filter_map { |attrs| attrs[:id].presence }
      return Failure(:VALIDATION_FAILED,
                     { message: "node id is not uuid-shaped", field: :nodes }) if supplied.any? { |id| !id.match?(Accounts::UUID_REGEX) }
      return Failure(:VALIDATION_FAILED,
                     { message: "a node id is repeated in the input", field: :nodes }) if supplied.uniq.size != supplied.size
      return Failure(:VALIDATION_FAILED,
                     { message: "a node id collides with the plan uuid", field: :nodes }) if supplied.include?(client_uuid)

      foreign = supplied.find do |id|
        !current_user.knowledge_nodes.exists?(id: id) && KnowledgeNode.exists?(id: id)
      end
      return Failure(:VALIDATION_FAILED,
                     { message: "a node id already belongs to another user's node", field: :nodes }) if foreign

      nil
    end

    # The positions whose client-supplied id already names one of the
    # caller's OWN nodes — skipped at creation (the row stays untouched,
    # retry-safe); edges addressing them drop via the membership rule.
    def skipped_node_positions(nodes_attrs, current_user)
      nodes_attrs.each_index.select do |index|
        id = nodes_attrs[index][:id].presence
        id && current_user.knowledge_nodes.exists?(id: id)
      end
    end

    # Resolve + insert the plan's edges (the module comment's three rules).
    # The unique [from_node_id, to_node_id] index is the DB floor under the
    # in-memory dedupe.
    def build_plan_edges(plan, nodes, edge_pairs)
      node_at = nodes.to_h { |node| [node.order, node] }
      stage_rank = stage_ranks(nodes)
      seen = {}
      edge_pairs.filter_map do |from_position, to_position|
        from = node_at[from_position]
        to = node_at[to_position]
        next drop_edge(plan, "edge endpoint is not a member node") if from.nil? || to.nil?
        unless stage_rank[from.id] && stage_rank[to.id] && stage_rank[from.id] < stage_rank[to.id]
          next drop_edge(plan, "edge is not stage-forward")
        end
        next drop_edge(plan, "edge repeats an earlier [from, to] pair") if seen[[from.id, to.id]]

        seen[[from.id, to.id]] = true
        plan.knowledge_node_edges.create!(user_id: plan.user_id, from_node: from, to_node: to)
      end
    end

    # The plan's stage sequence: distinct non-blank stage labels in node
    # order, first-appearance indexed. A stageless node has no rank — every
    # edge touching one drops (its learning order is unverifiable).
    def stage_ranks(nodes)
      by_stage = {}
      nodes.sort_by(&:order).each do |node|
        next if node.stage.blank?

        by_stage[node.stage] ||= by_stage.size
      end
      nodes.to_h { |node| [node.id, node.stage.blank? ? nil : by_stage[node.stage]] }
    end

    # The silent-but-logged drop (epic-16 spec): a dropped edge degrades the
    # roadmap's visuals; it never blocks creation (AD-12 — no new error
    # values). The line is an English log line, never user-facing (AD-9).
    def drop_edge(plan, reason)
      Rails.logger.info("[plans] dropped an invalid edge on plan #{plan.id}: #{reason}")
      nil
    end
  end
end
