# frozen_string_literal: true

module Ai
  # GenerateQuiz (AD-16/AD-5/AD-6/NFR-1, epic P2-5 ticket 03; targeting epic
  # P2-10 T5): assemble the scope's context server-side, call the provider
  # once, normalize the reply, and persist through Quiz::CreateSessionCommand
  # — the epic P2-3 command is the ONLY write path (its replay, ownership,
  # scope, and shape validations all apply to AI output like to client input;
  # the enum-guard here is the upstream net).
  #
  # Scope (T5): exactly ONE of plan_id / task_id / targeting.nodeId. The
  # targeting input (FR-21) has two shapes — absent-nodeId (`{}`) biases a
  # PLAN-scope generation with the deterministic weak-spot quota plan
  # (Ai::Targeting over the recorded delta-grill weights; the prompt carries
  # the quotas, the sections still come only from plan_scope — FR-18), while
  # a nodeId scopes the generation to that plan node (T3's Quick Test loop):
  # node_scope(plan, node) grounding, every question attributed to the node,
  # the session still owned by the plan (AD-6). A task node's id under
  # targeting is VALIDATION_FAILED (a task quiz already has its scope), and
  # so is a present-but-blank nodeId (`""`/whitespace) on any scope — blank
  # is not absent (the blank planId refusal's mirror): the input is either
  # without a nodeId entirely or carries a real one. A task scope with the
  # empty targeting hash ignores it (a task's single-material scope is
  # already the tightest possible bias).
  #
  # Replay-before-spend: the client-supplied session uuid keeps its delta-3
  # semantics. A session already exists for this user → the command returns
  # it through CreateSessionCommand WITHOUT a provider call; the uuid owned
  # by a different user → VALIDATION_FAILED before anything is generated. A
  # network-timeout retry therefore never spends two cap calls.
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND; cap →
  # CAP_REACHED (passed through from the seam); a provider reply with NO
  # usable question after normalization → INTERNAL (a provider-contract
  # violation, not a user mistake). Individual unusable questions (bad kind,
  # foreign node, unknown section, malformed choice shape) are DROPPED — a
  # partially-usable generation beats wasting the spent call.
  class GenerateQuizCommand < ApplicationCommand
    # A node-scoped quiz (T5's Quick Test): the node owns generation scope +
    # attribution, the plan owns the session (a session still attributes to
    # exactly one plan or task — AD-6).
    NodeScope = Struct.new(:plan, :node, keyword_init: true)

    option :current_user
    option :client_uuid
    option :mode
    option :language
    option :plan_id, optional: true
    option :task_id, optional: true
    # The QuizTargetingInput as a plain Hash ({ node_id: } | {}) — the
    # mutation converts; nil = targeting absent (today's behavior untouched).
    option :targeting, optional: true

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      # Shape guards BEFORE anything is spent (the delta-3 triad's shape
      # refusal + the mode vocabulary — a garbage uuid or mode never
      # reaches the provider or burns a cap call).
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
      return Failure(:VALIDATION_FAILED, { message: "mode is invalid", field: :mode }) unless Quiz::MODES.include?(mode.to_s)

      scope = resolve_scope
      return scope if scope.failure?

      session = QuizSession.find_by(id: client_uuid.to_s)
      if session
        # Owned (this user) → the delta-3 replay, WITHOUT a provider call and
        # without re-applying the payload (the original rows stand — the
        # same-success shape CreateSessionCommand uses). Foreign →
        # VALIDATION_FAILED before generating.
        return cross_user_uuid_failure if session.user_id != current_user.id

        return Success(session: session, questions: session.questions.order(:position, :created_at, :id))
      end
      return cross_user_uuid_failure if QuizSession.exists?(id: client_uuid.to_s)

      context = build_context(scope.value!)
      return context if context.failure?

      provider = Ai::Provider.complete(user: current_user, messages: build_messages(scope.value!, context.value!))
      return provider if provider.failure?

      questions = normalize_questions(provider.value!, scope.value!)
      return internal_payload_failure if questions.empty?

      create_session(scope.value!, questions: questions)
    end

    private

    # The session's scope, ownership-checked BEFORE anything is spent
    # (mirrors CreateSessionCommand's own resolution — the same codes, so a
    # validation never differs between the two layers).
    def resolve_scope
      if plan_id.present? && task_id.present?
        return Failure(:VALIDATION_FAILED,
                       { message: "scope a quiz session by plan or task, not both", field: :planId })
      end
      # Blank ≠ absent (the blank planId refusal's mirror): a present-but-blank
      # nodeId must not normalize into the weak-spot quota shape (or be
      # silently ignored on a task) — the input is either without a nodeId
      # entirely or carries a real one.
      if targeting_blank_node_id?
        return Failure(:VALIDATION_FAILED,
                       { message: "targeting nodeId is blank — pass a real node id or drop the targeting input",
                         field: :nodeId })
      end
      if targeting_node_id
        if plan_id.present? || task_id.present?
          return Failure(:VALIDATION_FAILED,
                         { message: "scope a quiz session by plan, task, or targeting node — not several", field: :nodeId })
        end
        # AD-13 uniform posture: a foreign OR malformed node id reads
        # NOT_FOUND — never an existence leak.
        return Failure(:NOT_FOUND, { message: "node not found" }) unless targeting_node_id.match?(Accounts::UUID_REGEX)
        node = current_user.knowledge_nodes.find_by(id: targeting_node_id)
        return Failure(:NOT_FOUND, { message: "node not found" }) unless node
        return Failure(:VALIDATION_FAILED,
                       { message: "targeting needs a plan node — a task node scopes through its task",
                         field: :nodeId }) if node.plan_id.blank?
        plan = current_user.study_plans.find_by(id: node.plan_id)
        return plan ? Success(NodeScope.new(plan: plan, node: node)) : Failure(:NOT_FOUND, { message: "plan not found" })
      end
      if plan_id.present?
        return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan_id.to_s.match?(Accounts::UUID_REGEX)
        plan = current_user.study_plans.find_by(id: plan_id)
        return plan ? Success(plan) : Failure(:NOT_FOUND, { message: "plan not found" })
      end
      if task_id.present?
        return Failure(:NOT_FOUND, { message: "task not found" }) unless task_id.to_s.match?(Accounts::UUID_REGEX)
        task = current_user.study_tasks.find_by(id: task_id)
        return task ? Success(task) : Failure(:NOT_FOUND, { message: "task not found" })
      end

      Failure(:VALIDATION_FAILED, { message: "a quiz session needs a plan or a task scope", field: :planId })
    end

    # The targeting nodeId: nil = the "without nodeId" shapes (the input
    # absent, `{}`, or an explicit null — GraphQL null reads as no value);
    # otherwise the stripped string. A present-but-blank string is NOT
    # normalized away here — targeting_blank_node_id? flags it so
    # resolve_scope refuses it before anything is spent.
    def targeting_node_id
      return nil unless targeting.is_a?(Hash)

      (targeting[:node_id] || targeting["node_id"]).to_s.strip.presence
    end

    # True exactly when a nodeId VALUE is present but blank (`""`/whitespace)
    # — the shape that must never read as the weak-spot "without nodeId".
    def targeting_blank_node_id?
      return false unless targeting.is_a?(Hash)

      raw = targeting[:node_id] || targeting["node_id"]
      !raw.nil? && raw.to_s.strip.blank?
    end

    def build_context(scope)
      assembled = case scope
      when StudyPlan then Ai::ContextAssembler.plan_scope(scope)
      when NodeScope then Ai::ContextAssembler.node_scope(scope.plan, scope.node)
      else Ai::ContextAssembler.task_scope(scope)
      end
      Success(assembled)
    end

    # The prompt: quota-carrying exactly when the empty targeting hash rides
    # a plan scope (the weak-spot shape); every other scope builds today's
    # prompt byte-for-byte. One provider call either way (AD-16).
    def build_messages(scope, context)
      quota_plan = plan_quota_plan(scope)
      return Ai::Prompts.quiz(mode: mode, language: language, context: context) unless quota_plan

      Ai::Prompts.quiz(mode: mode, language: language, context: context, quota_plan: quota_plan)
    end

    # The weak-spot quota text for the prompt — nil unless the targeting
    # input is present WITHOUT a nodeId and the scope is the plan itself.
    def plan_quota_plan(scope)
      return nil unless targeting.is_a?(Hash) && targeting_node_id.blank? && scope.is_a?(StudyPlan)

      quotas = Ai::Targeting.allocate(candidates: targeting_candidates(scope), total: Ai::Prompts::QUESTION_TARGET)
      return nil if quotas.empty?

      quota_plan_text(scope, quotas)
    end

    # The bias inputs through their ONE sources (AD-14: Mastery is the only
    # scorer — the score rides in its published String! percent form, the
    # wire's exact value; AD-6: mistakes by node attribution). Evidence is
    # batch-loaded once in the wire's order convention (created_at, id —
    # Mastery windows and freshness-caps internally, now: Time.current like
    # the wire resolvers).
    def targeting_candidates(plan)
      nodes = plan.knowledge_nodes.order(:order, :id)
      node_ids = nodes.map(&:id)
      evidence = EvidenceRecord.where(user_id: current_user.id, node_id: node_ids)
                               .order(:created_at, :id)
                               .group_by(&:node_id)
      mistake_counts = MistakeEntry.where(user_id: current_user.id, node_id: node_ids).group(:node_id).count
      nodes.map do |node|
        Ai::Targeting::Candidate.new(
          id: node.id,
          score: Mastery.compute_node_score(evidence[node.id] || [], now: Time.current).to_s,
          mistakes: mistake_counts[node.id].to_i
        )
      end
    end

    def quota_plan_text(scope, quotas)
      scope.knowledge_nodes.order(:order, :id).filter_map do |node|
        quota = quotas[node.id]
        next if quota.nil?

        "[node id=#{node.id}] #{node.title} — exactly #{quota} question#{quota == 1 ? "" : "s"}"
      end.join("\n")
    end

    # Normalization IS the enum-guard (ticket AC): only open/choice shapes
    # with in-scope addresses survive; everything else is dropped.
    def normalize_questions(raw, scope)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return [] unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["questions"] : nil
      return [] unless candidates.is_a?(Array)

      nodes = if scope.is_a?(StudyPlan)
        scope.knowledge_nodes.index_by(&:id)
      else
        { scope.node.id => scope.node } # a task's single auto-node, or the targeted Quick Test node
      end
      materials = Material.where(user_id: current_user.id, id: candidates.filter_map { |q| q.is_a?(Hash) && q["sourceMaterialId"] })
                         .index_by(&:id)
      scope_material_ids = scope_material_relation(scope).ids

      candidates.filter_map do |question|
        next unless question.is_a?(Hash)
        next unless Quiz::QUESTION_KINDS.include?(question["kind"])
        next unless usable_prompt?(question)
        node = nodes[question["nodeId"]]
        next unless node
        material = materials[question["sourceMaterialId"]]
        next unless material
        next unless scope_material_ids.include?(material.id)
        next unless Ai::ContextAssembler.section_by_id(material, question["sourceSectionId"])

        normalized = {
          node_id: node.id,
          kind: question["kind"],
          prompt: question["prompt"],
          options: nil,
          correct_option_index: nil,
          source_material_id: material.id,
          source_section_id: question["sourceSectionId"],
          keywords: string_array(question["keywords"]),
          explanation: question["explanation"]
        }
        if question["kind"] == "choice"
          options = question["options"]
          index = question["correctOptionIndex"]
          next unless options.is_a?(Array) && options.length >= 2 && options.all? { |option| option.is_a?(String) }
          next unless index.is_a?(Integer) && index >= 0 && index < options.length
          normalized[:options] = options
          normalized[:correct_option_index] = index
        end
        normalized
      rescue StandardError
        next
      end
    end

    def usable_prompt?(question)
      question["prompt"].to_s.strip.present? && question["explanation"].to_s.strip.present? &&
        question["sourceSectionId"].to_s.strip.present?
    end

    # The scope's material pool, as relations (ids taken at the call site).
    def scope_material_relation(scope)
      case scope
      when StudyPlan
        Material.where(plan_id: scope.id)
      when NodeScope
        # The node_scope pool EXACTLY (FR-18): the plan-wide materials plus
        # THIS node's own pins — another node's pinned material never
        # normalizes in, mirroring ContextAssembler.node_scope's query.
        Material.where(plan_id: scope.plan.id, attachment_scope: "plan")
                .or(Material.where(plan_id: scope.plan.id, attachment_scope: "node", node_id: scope.node.id))
      else
        Material.where(id: scope.material_id)
      end
    end

    def string_array(value)
      return nil unless value.is_a?(Array)

      terms = value.select { |term| term.is_a?(String) && term.strip.present? }
      terms.empty? ? nil : terms
    end

    # The one write path: the epic P2-3 command. A NodeScope session is owned
    # by its plan (the Quick Test rides the plan's quiz surface — AD-6).
    def create_session(scope, questions:)
      args = { current_user: current_user, client_uuid: client_uuid, mode: mode, questions: questions }
      case scope
      when StudyTask then args[:task_id] = scope.id
      when NodeScope then args[:plan_id] = scope.plan.id
      else args[:plan_id] = scope.id
      end
      Quiz::CreateSessionCommand.call(**args)
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai quiz payload had no usable questions" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's quiz session", field: :clientUuid })
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end
  end
end
