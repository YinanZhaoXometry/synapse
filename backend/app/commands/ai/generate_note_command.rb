# frozen_string_literal: true

module Ai
  # GenerateNote (FR-40, epic P2-12 T1; delta decisions 1+4+5): a synchronous
  # generation mutation through the adapter — the same shape as GenerateQuiz:
  # assemble the scope's context server-side, ONE cap-counted provider call
  # (AD-16), and persist the reply as a user-scoped Note (delta decision 4).
  # The reply is the Markdown note itself (Prompts.note's reply contract); the
  # command keeps it verbatim as the body — the model's
  # [[enrich|kind|suggestion]] enrichment markers (delta decision 1's
  # markers-only v1) stay in the body for export AND ride the enrichment
  # jsonb as the structured marker array.
  #
  # Scope: exactly ONE of plan_id / node_id / material_id, and the present id
  # must match the `scope` value (the xor validated at command level). A
  # node scope needs a PLAN node (a task's auto-node refuses with
  # VALIDATION_FAILED — the GenerateQuiz targeting posture). Context
  # assembly: plan → plan_scope (the plan-wide materials, FR-44), node →
  # node_scope (plan-wide + the node's own pins), material → that material's
  # sections (material_scope). Cross-user / unknown / malformed ids answer
  # NOT_FOUND uniformly (AD-13 — never an existence leak).
  #
  # Replay-before-spend: the client-supplied note uuid keeps the delta-3
  # semantics — a note already exists for this user → returned WITHOUT a
  # provider call (a timeout retry never spends two cap calls); the uuid
  # owned by a different user → VALIDATION_FAILED before anything is spent.
  #
  # The user-requested annotation: an optional `enrich_at` free text adds ONE
  # extra [[enrich|user|<free text>]] marker after generation — at the END of
  # the body unless the text matches a paragraph substring in the body, in
  # which case right after that paragraph. Blank ≠ present here on purpose:
  # the annotation is content, not an address — blank adds nothing, honestly.
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND; cap →
  # CAP_REACHED (passed through from the seam); a provider reply with no
  # usable body → INTERNAL (a provider-contract violation, not a user
  # mistake). The title derives from the note's first H1, falling back to the
  # scope record's own name (plan.topic / node.title / material.title).
  class GenerateNoteCommand < ApplicationCommand
    SCOPES = %w[plan node material].freeze

    option :current_user
    option :client_uuid
    option :scope
    option :language
    option :plan_id, optional: true
    option :node_id, optional: true
    option :material_id, optional: true
    option :enrich_at, optional: true

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)
      return Failure(:VALIDATION_FAILED, { message: "scope is invalid", field: :scope }) unless SCOPES.include?(scope.to_s)

      resolved = resolve_scope
      return resolved if resolved.failure?

      # Replay-before-spend (the GenerateQuiz posture): an owned uuid returns
      # the existing note untouched; a foreign uuid is VALIDATION_FAILED.
      existing = Note.find_by(id: client_uuid.to_s)
      return cross_user_uuid_failure if existing && existing.user_id != current_user.id
      return Success(note: existing) if existing

      context = build_context(resolved.value!)
      provider = Ai::Provider.complete(user: current_user, messages: Ai::Prompts.note(language: language, context: context))
      return provider if provider.failure?

      body = provider.value!.to_s.strip
      return internal_payload_failure if body.empty?

      Success(note: persist_note(resolved.value!, body))
    end

    private

    # The scope's record, ownership-checked BEFORE anything is spent — the
    # id presence must match the scope value exactly (zero ids, several ids,
    # or an id that disagrees with the scope all refuse; the ids themselves
    # answer NOT_FOUND uniformly for malformed/unknown/foreign).
    def resolve_scope
      present_ids = { "plan" => plan_id, "node" => node_id, "material" => material_id }
                    .select { |_key, id| id.present? }
      return scope_missing_failure if present_ids.empty?
      return scope_ambiguous_failure if present_ids.size > 1

      scope_key = present_ids.keys.sole
      return Failure(:VALIDATION_FAILED, { message: "scope and id do not match", field: :scope }) unless scope_key == scope.to_s

      id = present_ids[scope_key].to_s
      return Failure(:NOT_FOUND, { message: "#{scope_key} not found" }) unless id.match?(Accounts::UUID_REGEX)

      record = case scope_key
      when "plan" then current_user.study_plans.find_by(id: id)
      when "node" then current_user.knowledge_nodes.find_by(id: id)
      else current_user.materials.find_by(id: id)
      end
      return Failure(:NOT_FOUND, { message: "#{scope_key} not found" }) unless record

      if scope_key == "node" && record.plan_id.blank?
        return Failure(:VALIDATION_FAILED,
                       { message: "a note's node scope needs a plan node — a task node scopes through its material",
                         field: :nodeId })
      end

      Success([ scope_key, record ])
    end

    def build_context(scope)
      scope_key, record = scope
      assembled = case scope_key
      when "plan" then Ai::ContextAssembler.plan_scope(record)
      when "node" then Ai::ContextAssembler.node_scope(record.plan, record)
      else Ai::ContextAssembler.material_scope(record)
      end
      assembled
    end

    # The one write path for AI notes (no pre-existing Notes command — the
    # epic P2-3 contexts predate the entity). The client uuid IS the note's
    # id, making the delta-3 replay exact. The scope columns follow the DB's
    # exactly-one check: the scope record's id rides, the other two stay null
    # (a material-scoped note keeps plan_id null even for a plan-attached
    # material — the plan's notes list reaches it through the plan's
    # materials, not through plan_id).
    def persist_note(scope, body)
      scope_key, record = scope
      body = apply_user_marker(body, enrich_at)
      Note.create!(
        id: client_uuid.to_s,
        user: current_user,
        scope: scope_key,
        plan_id: scope_key == "plan" ? record.id : nil,
        node_id: scope_key == "node" ? record.id : nil,
        material_id: scope_key == "material" ? record.id : nil,
        title: extract_title(body, scope_title(record)),
        body: body,
        enrichment: extract_markers(body),
        targeting: []
      )
    end

    # The user-requested annotation (delta decision 1): ONE extra
    # [[enrich|user|…]] marker line — after the paragraph the enrich_at text
    # matches as a substring (first match wins), else at the END of the body.
    def apply_user_marker(body, enrich_at)
      text = enrich_at.to_s.strip
      return body if text.blank?

      marker = "[[enrich|user|#{text}]]"
      match = body.index(text)
      return "#{body}\n\n#{marker}" unless match

      paragraph_end = body.index("\n\n", match) || body.length
      body.dup.insert(paragraph_end, "\n\n#{marker}")
    end

    # The markers as the structured array (delta decision 1): every
    # well-formed [[enrich|kind|suggestion]] occurrence in the final body,
    # in document order. Unknown kinds ride verbatim — the body is the
    # source of truth, the array its structured read.
    def extract_markers(body)
      body.scan(/\[\[enrich\|([^|\]]+)\|([^\]]+)\]\]/).map do |(kind, suggestion)|
        { "kind" => kind.strip, "suggestion" => suggestion.strip }
      end
    end

    # The title: the note's first H1 heading, else the scope record's own
    # name — both materials-sourced, never invented.
    def extract_title(body, fallback)
      heading = body[/^#\s+(.+)$/, 1].to_s.strip
      heading.present? ? heading : fallback
    end

    def scope_title(record)
      record.is_a?(StudyPlan) ? record.topic : record.title
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai note payload had no usable body" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's note", field: :clientUuid })
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def scope_missing_failure
      Failure(:VALIDATION_FAILED,
              { message: "a note needs exactly one scope — plan, node, or material", field: :scope })
    end

    def scope_ambiguous_failure
      Failure(:VALIDATION_FAILED,
              { message: "scope a note by plan, node, or material — not several", field: :scope })
    end
  end
end
