# frozen_string_literal: true

module Ai
  # GenerateQuiz (AD-16/AD-5/AD-6/NFR-1, epic P2-5 ticket 03; targeting epic
  # P2-10 T5): assemble the scope's context server-side, call the provider
  # once, normalize the reply, and persist through Quiz::CreateSessionCommand
  # — the epic P2-3 command is the ONLY write path (its replay, ownership,
  # scope, and shape validations all apply to AI output like to client input;
  # the enum-guard here is the upstream net).
  #
  # Scope (T5): exactly ONE of plan_id / task_id / targeting.nodeId — joined
  # by material_id in epic-13 T2 (FR-14, the reader's Quick Test; the kickoff
  # delta decision 4), so the xor is FOUR-way: planId | taskId |
  # targeting.nodeId | materialId. The targeting input (FR-21) has two shapes
  # — absent-nodeId (`{}`) biases a PLAN-scope generation with the
  # deterministic weak-spot quota plan (Ai::Targeting over the recorded
  # delta-grill weights; the prompt carries the quotas, the sections still
  # come only from plan_scope — FR-18), while a nodeId scopes the generation
  # to that plan node (T3's Quick Test loop): node_scope(plan, node)
  # grounding, every question attributed to the node, the session still owned
  # by the plan (AD-6). A task node's id under targeting is VALIDATION_FAILED
  # (a task quiz already has its scope), and so is a present-but-blank nodeId
  # (`""`/whitespace) on any scope — blank is not absent (the blank planId
  # refusal's mirror): the input is either without a nodeId entirely or
  # carries a real one. A task scope with the empty targeting hash ignores it
  # (a task's single-material scope is already the tightest possible bias).
  #
  # The material scope (T2, AD-6's honesty law): evidence records belong to
  # NODES, so a section/selection Quick Test generates only when the material
  # carries ≥1 CONFIRMED section→node mapping — the gate refuses earlier
  # with VALIDATION_FAILED (field materialId) before anything is spent. The
  # context is the material's sections (all, or narrowed to section_ids —
  # each must exist on the material); the confirmed pairs ride the prompt as
  # an explicit attribution map and OWN the attribution server-side: a
  # question's node is its cited section's mapped node (the model's own
  # nodeId never decides here), a question citing an unmapped section DROPS,
  # and the count may land honestly below targetCount. sectionIds /
  # targetCount without materialId are refused (they are Quick Test inputs,
  # never silent hints on other scopes); targetCount is 3..5 (default 5).
  # The session is owned by the material's plan (the gate's mappings attach
  # to plan nodes — a material without a plan cannot pass the gate).
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

    # A material-scoped Quick Test (T2, FR-14): the material owns generation
    # scope, the confirmed section→node pairs own attribution (server-side),
    # the material's plan owns the session. section_ids nil = every section;
    # target_count is the resolved 3..5 question count (default 5).
    MaterialScope = Struct.new(:material, :section_ids, :target_count, keyword_init: true)

    QUICK_TEST_COUNT_BOUNDS = (3..5).freeze
    QUICK_TEST_MAX_SECTIONS = 5

    option :current_user
    option :client_uuid
    option :mode
    option :language
    option :plan_id, optional: true
    option :task_id, optional: true
    # The QuizTargetingInput as a plain Hash ({ node_id: } | {}) — the
    # mutation converts; nil = targeting absent (today's behavior untouched).
    option :targeting, optional: true
    # The material Quick Test scope (epic-13 T2, FR-14) + its two narrowing
    # inputs; nil = absent, the pre-T2 shapes byte-for-byte.
    option :material_id, optional: true
    option :section_ids, optional: true
    option :target_count, optional: true

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
      # The material Quick Test cluster (epic-13 T2, FR-14): materialId is the
      # FOURTH xor member and sectionIds/targetCount are its narrowing inputs —
      # any of them present takes over resolution (so a materialId alongside
      # plan/task/node refuses below, and the narrowers alone refuse too).
      return resolve_material_scope if material_id.present? || quick_test_narrowers_present?
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

    # True when a Quick Test narrowing input RODE (nil = absent — GraphQL null
    # reads as no value, the targeting nodeId discipline). An empty sectionIds
    # array is present-but-empty and refused in the validation below, never
    # normalized into "all sections".
    def quick_test_narrowers_present?
      !section_ids.nil? || !target_count.nil?
    end

    # The material scope branch (epic-13 T2): the four-way xor check, the
    # uniform-NOT_FOUND material resolution, the confirmed-mapping GATE
    # (AD-6: evidence is node-attributed — no mapping, no quick test), and
    # the sectionIds/targetCount validations. Nothing here calls the provider.
    def resolve_material_scope
      if plan_id.present? || task_id.present? || targeting_node_id
        return Failure(:VALIDATION_FAILED,
                       { message: "scope a quiz session by plan, task, targeting node, or material — not several",
                         field: :materialId })
      end
      if material_id.blank?
        return Failure(:VALIDATION_FAILED,
                       { message: "sectionIds/targetCount ride the material Quick Test scope only — pass materialId",
                         field: :sectionIds })
      end
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material

      pairs = confirmed_section_pairs(material)
      if pairs.empty? || material.plan_id.blank?
        return Failure(:VALIDATION_FAILED,
                       { message: "quick test needs a confirmed node mapping — evidence is node-attributed, " \
                                  "so link the material's sections to plan nodes first",
                         field: :materialId })
      end

      validation = validate_quick_test_inputs(material)
      return validation if validation

      Success(MaterialScope.new(
                material: material,
                section_ids: narrowed_section_ids(material),
                target_count: resolved_target_count
              ))
    end

    # The confirmed section→node pairs, in stable mapping order — the scope's
    # attribution map (the gate reads the same query).
    def confirmed_section_pairs(material)
      MaterialNodeMapping.where(user_id: current_user.id, material_id: material.id, status: "confirmed")
                        .joins(:node)
                        .where.not(knowledge_nodes: { plan_id: nil })
                        .order(:created_at, :id)
                        .filter_map { |row| [ row.section_id, row.node ] if row.node_id }
                        .to_h
    end

    def validate_quick_test_inputs(material)
      unless section_ids.nil?
        return Failure(:VALIDATION_FAILED,
                       { message: "sectionIds is empty — pass section ids or drop the input", field: :sectionIds }) if section_ids.empty?
        if section_ids.length > QUICK_TEST_MAX_SECTIONS
          return Failure(:VALIDATION_FAILED,
                         { message: "sectionIds carries more than #{QUICK_TEST_MAX_SECTIONS} sections", field: :sectionIds })
        end
        section_ids.each do |section_id|
          next if Ai::ContextAssembler.section_by_id(material, section_id)

          return Failure(:VALIDATION_FAILED,
                         { message: "sectionIds names a section this material does not have", field: :sectionIds })
        end
      end
      return if target_count.nil? || QUICK_TEST_COUNT_BOUNDS.cover?(target_count)

      Failure(:VALIDATION_FAILED,
              { message: "targetCount is outside the Quick Test band (#{QUICK_TEST_COUNT_BOUNDS}) — pass #{QUICK_TEST_COUNT_BOUNDS.first}–#{QUICK_TEST_COUNT_BOUNDS.last} or drop the input",
                field: :targetCount })
    end

    def narrowed_section_ids(material)
      return nil if section_ids.nil?

      section_ids.uniq.select { |section_id| Ai::ContextAssembler.section_by_id(material, section_id) }
    end

    def resolved_target_count
      target_count.nil? ? Ai::Prompts::QUESTION_TARGET : target_count
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
      when MaterialScope then Ai::ContextAssembler.quick_test_scope(attribution_nodes(scope), scope.material,
                                                                    section_ids: scope.section_ids)
      else Ai::ContextAssembler.task_scope(scope)
      end
      Success(assembled)
    end

    # The prompt: quota-carrying exactly when the empty targeting hash rides
    # a plan scope (the weak-spot shape); attribution-map-carrying exactly
    # when the material scope rides (T2). Every other scope builds today's
    # prompt byte-for-byte. One provider call either way (AD-16).
    def build_messages(scope, context)
      quota_plan = plan_quota_plan(scope)
      attribution = material_attribution_note(scope)
      return Ai::Prompts.quiz(mode: mode, language: language, context: context,
                              question_target: scope.target_count, attribution_note: attribution) if scope.is_a?(MaterialScope)
      return Ai::Prompts.quiz(mode: mode, language: language, context: context) unless quota_plan

      Ai::Prompts.quiz(mode: mode, language: language, context: context, quota_plan: quota_plan)
    end

    # The mapped nodes of a material scope, in pair order, deduped — the
    # [nodes] block the prompt's nodeId vocabulary reads from.
    def attribution_nodes(scope)
      confirmed_section_pairs(scope.material).values.uniq
    end

    # The confirmed pairs as the prompt's attribution-map lines — nil for any
    # non-material scope (the note slot stays empty there, byte-for-byte).
    def material_attribution_note(scope)
      return nil unless scope.is_a?(MaterialScope)

      confirmed_section_pairs(scope.material).map { |section_id, node| %("- #{section_id}" → node #{node.id}) }
    end

    # The weak-spot quota text for the prompt — nil unless the targeting
    # input is present WITHOUT a nodeId and the scope is the plan itself.
    def plan_quota_plan(scope)
      return nil unless targeting.is_a?(Hash) && targeting_node_id.blank? && scope.is_a?(StudyPlan)

      quotas = Ai::Targeting.allocate(candidates: targeting_candidates(scope), total: Ai::Prompts::QUESTION_TARGET)
      return nil if quotas.empty?

      quota_plan_text(scope, quotas)
    end

    # The bias inputs through their ONE source (AD-14: Mastery is the only
    # scorer; AD-6: mistakes by node attribution) — the shared builder both
    # targeting commands call (epic P2-12 T2 extracted it verbatim when the
    # note command grew the same bias; no second heuristic, FR-21).
    def targeting_candidates(plan)
      Ai::TargetingCandidates.for(user: current_user, plan: plan)
    end

    def quota_plan_text(scope, quotas)
      scope.knowledge_nodes.order(:order, :id).filter_map do |node|
        quota = quotas[node.id]
        next if quota.nil?

        "[node id=#{node.id}] #{node.title} — exactly #{quota} question#{quota == 1 ? "" : "s"}"
      end.join("\n")
    end

    # Normalization IS the enum-guard (ticket AC): only open/choice shapes
    # with in-scope addresses survive; everything else is dropped. The
    # material scope's attribution is SERVER-OWNED: the cited section's
    # confirmed mapped node decides (the model's own nodeId never does), and
    # a question citing an unmapped/unknown section drops — the count may
    # land honestly below the target (T2's spec'd posture).
    def normalize_questions(raw, scope)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return [] unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["questions"] : nil
      return [] unless candidates.is_a?(Array)

      pairs = scope.is_a?(MaterialScope) ? confirmed_section_pairs(scope.material) : nil
      nodes = if scope.is_a?(StudyPlan)
        scope.knowledge_nodes.index_by(&:id)
      elsif scope.is_a?(MaterialScope)
        {} # the pairs map decides below (keyed by SECTION id, not nodeId)
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
        node = pairs ? pairs[question["sourceSectionId"]] : nodes[question["nodeId"]]
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
      when MaterialScope
        Material.where(id: scope.material.id)
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
    # by its plan (the Quick Test rides the plan's quiz surface — AD-6); a
    # MaterialScope session is owned by the material's plan (the gate's
    # confirmed mappings attach to plan nodes).
    def create_session(scope, questions:)
      args = { current_user: current_user, client_uuid: client_uuid, mode: mode, questions: questions }
      case scope
      when StudyTask then args[:task_id] = scope.id
      when NodeScope then args[:plan_id] = scope.plan.id
      when MaterialScope then args[:plan_id] = scope.material.plan_id
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
