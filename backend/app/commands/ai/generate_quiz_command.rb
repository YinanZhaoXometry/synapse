# frozen_string_literal: true

module Ai
  # GenerateQuiz (AD-16/AD-5/AD-6/NFR-1, epic P2-5 ticket 03): assemble the
  # scope's context server-side, call the provider once, normalize the reply,
  # and persist through Quiz::CreateSessionCommand — the epic P2-3 command is
  # the ONLY write path (its replay, ownership, scope, and shape validations
  # all apply to AI output like to client input; the enum-guard here is the
  # upstream net).
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
    option :current_user
    option :client_uuid
    option :mode
    option :language
    option :plan_id, optional: true
    option :task_id, optional: true

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)

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

      messages = Ai::Prompts.quiz(mode: mode, language: language, context: context.value!)
      provider = Ai::Provider.complete(user: current_user, messages: messages)
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

    def build_context(scope)
      assembled = scope.is_a?(StudyPlan) ? Ai::ContextAssembler.plan_scope(scope) : Ai::ContextAssembler.task_scope(scope)
      Success(assembled)
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
        { scope.node.id => scope.node } # a task's single auto-node
      end
      materials = Material.where(user_id: current_user.id, id: candidates.filter_map { |q| q.is_a?(Hash) && q["sourceMaterialId"] })
                         .index_by(&:id)
      scope_material_ids = (scope.is_a?(StudyPlan) ? Material.where(plan_id: scope.id) : Material.where(id: scope.material_id))
                           .ids

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

    def string_array(value)
      return nil unless value.is_a?(Array)

      terms = value.select { |term| term.is_a?(String) && term.strip.present? }
      terms.empty? ? nil : terms
    end

    # The one write path: the epic P2-3 command.
    def create_session(scope, questions:)
      Quiz::CreateSessionCommand.call(
        current_user: current_user,
        client_uuid: client_uuid,
        plan_id: scope.is_a?(StudyPlan) ? scope.id : nil,
        task_id: scope.is_a?(StudyTask) ? scope.id : nil,
        mode: mode,
        questions: questions
      )
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai quiz payload had no usable questions" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's quiz session", field: :clientUuid })
    end
  end
end
