# frozen_string_literal: true

module Ai
  # CreateLesson (epic-36 T1, spec decision 5 — the unified create behind
  # both entries): the generated Material row lands HERE, whatever the
  # entry. Two shapes, exactly one (the xor refuses mixes):
  #
  #   ② node — inputs plan_id + node_id (+ the replay client_uuid). The
  #     outline is generated INTERNALLY: one cap-counted
  #     Prompts.lesson_outline call over ContextAssembler.node_grounding
  #     (the single node + its confirmed mapped sections — the
  #     node_grounding discipline, plan-wide pools never ride). An unmapped
  #     node refuses VALIDATION_FAILED with the honest reason BEFORE the
  #     call (the action's disabled-with-a-reason posture's server mirror).
  #     Chapters keep only confirmed mapped sections (their anchors name the
  #     material owning each section); zero usable chapters → INTERNAL.
  #   ① material — inputs material_id + the echoed outline (+ the replay
  #     client_uuid). NO provider call: the outline came from
  #     ProposeLessonOutlineCommand's gate and is re-validated here
  #     server-side (≤ Ai::Lessons::MATERIAL_MAX_SECTIONS chapters, unique
  #     titles, every sourceSectionId resolving on the source material) —
  #     the confirm mutation trusts nothing the wire carried.
  #
  # The product (both shapes): origin=generated, kind=markdown,
  # parse_state=parsed, no blob, sections EMPTY (the stream op fills them
  # per section), generation jsonb = {variant, sourceMaterialIds, outline
  # placeholders (pending), pausedKind: nil, generatedAt} (spec decision 2).
  # The row's id IS the client uuid (delta-3 replay-exact, the
  # GenerateNoteCommand precedent). Singletons: at most one lesson per node
  # (② — found by origin+node_id) and per source material (① — found by the
  # generation jsonb's sourceMaterialIds); an existing one returns
  # idempotently with no provider call.
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND; cap
  # → CAP_REACHED (passed through from the seam, ② only).
  class CreateLessonCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :language
    option :plan_id, optional: true
    option :node_id, optional: true
    option :material_id, optional: true
    # The echoed outline as a plain Array (the mutation converts the input
    # objects); nil = absent (the ② shape).
    option :outline, optional: true

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      shape = resolve_shape
      return shape if shape.failure?

      # The delta-3 triad before anything else (the GenerateQuiz posture):
      # an owned uuid returns the existing row untouched — no provider call
      # (②'s outline call included); a foreign uuid is VALIDATION_FAILED.
      existing = Material.find_by(id: client_uuid.to_s)
      return cross_user_uuid_failure if existing && existing.user_id != current_user.id
      return Success(material: existing) if existing

      shape.value! == :node ? create_node_lesson : create_material_lesson
    end

    private

    # The xor: ② (plan+node) vs ① (material+echoed outline) — mixed or
    # partial shapes refuse. A ② call carrying material/outline inputs (or
    # the reverse) is a shape violation, never a silent hint.
    def resolve_shape
      node_shape = plan_id.present? || node_id.present?
      material_shape = material_id.present? || outline.present?
      if node_shape && material_shape
        return Failure(:VALIDATION_FAILED,
                       { message: "create a lesson by plan+node or by material+outline — not several", field: :nodeId })
      end
      return Success(:node) if node_shape
      return Success(:material) if material_shape

      Failure(:VALIDATION_FAILED,
              { message: "a lesson needs a node scope (planId+nodeId) or a material scope (materialId+outline)",
                field: :nodeId })
    end

    # ── ② node ────────────────────────────────────────────────────────────

    def create_node_lesson
      plan = resolve_owned(plan_id, relation: :study_plans, label: "plan")
      return plan if plan.failure?

      node = resolve_node(plan.value!, node_id)
      return node if node.failure?

      # The per-node singleton: the node already owns a lesson → return it
      # (no call, no second row). Checked BEFORE the outline spend.
      existing = current_user.materials.find_by(origin: "generated", node_id: node.value!.id)
      return Success(material: existing) if existing

      grounding = Ai::ContextAssembler.node_grounding(plan.value!, node.value!)
      unless grounding.unmapped == false
        return Failure(:VALIDATION_FAILED,
                       { message: "the node has no confirmed material mapping — link a material's sections to it " \
                                  "before generating its lesson (nothing can be generated from thin air)",
                         field: :nodeId })
      end

      provider = Ai::Provider.complete(user: current_user,
                                       messages: Ai::Prompts.lesson_outline(
                                         language: language,
                                         context: grounding,
                                         material_title: node.value!.title,
                                         outline_target: Ai::Lessons::NODE_SECTION_MAX
                                       ))
      return provider if provider.failure?

      chapters = mapped_chapters(provider.value!, node.value!)
      return internal_outline_failure if chapters.empty?

      Success(material: persist_lesson(
        variant: Ai::Lessons::VARIANT_NODE,
        title: node.value!.title,
        plan_id: plan.value!.id,
        attachment_scope: "node",
        node: node.value!,
        source_material_ids: chapters.flat_map { |chapter| chapter[:material_ids] }.uniq,
        chapters: chapters
      ))
    end

    # Uniform-NOT_FOUND plan resolution (the reads convention — foreign,
    # unknown, malformed all answer the same).
    def resolve_owned(id, relation:, label:)
      return Failure(:NOT_FOUND, { message: "#{label} not found" }) unless id.to_s.match?(Accounts::UUID_REGEX)

      record = current_user.public_send(relation).find_by(id: id)
      record ? Success(record) : Failure(:NOT_FOUND, { message: "#{label} not found" })
    end

    # The node must ride the given plan (the plan_companion ownership
    # posture): plan-scoped lookup — a task node (plan_id blank), a node of
    # another plan, a foreign node, a malformed id: all uniform NOT_FOUND
    # (never an existence leak; a task scopes through its material).
    def resolve_node(plan, id)
      return Failure(:NOT_FOUND, { message: "node not found" }) unless id.to_s.match?(Accounts::UUID_REGEX)

      node = current_user.knowledge_nodes.find_by(id: id, plan_id: plan.id)
      node ? Success(node) : Failure(:NOT_FOUND, { message: "node not found" })
    end

    # The ② reply's chapters survive only over CONFIRMED mapped sections:
    # each kept section id maps to the mapping row's material, and the
    # chapter's anchors name that material (the reader's jump-to-source
    # vocabulary, server-owned).
    def mapped_chapters(raw, node)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return [] unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["chapters"] : nil
      return [] unless candidates.is_a?(Array)

      pairs = confirmed_pairs(node) # section_id → the material owning it
      candidates.filter_map do |chapter|
        next unless chapter.is_a?(Hash)

        title = chapter["title"].to_s.strip
        ids = Array(chapter["sourceSectionIds"]).uniq.select { |id| pairs.key?(id) }
        next if title.empty? || ids.empty?

        { title: title,
          anchors: ids.map { |id| { "materialId" => pairs[id].id, "sectionId" => id } },
          material_ids: ids.map { |id| pairs[id].id } }
      rescue StandardError
        next
      end.first(Ai::Lessons::NODE_SECTION_MAX)
    end

    # THIS node's confirmed section→material pairs (the node_teaching_mappings
    # query — the grounding's own source of truth).
    def confirmed_pairs(node)
      Ai::ContextAssembler.node_teaching_mappings(node.plan, node)
                          .filter_map { |row| [ row.section_id, row.material ] if row.material && Ai::ContextAssembler.section_by_id(row.material, row.section_id) }
                          .to_h
    end

    # ── ① material ────────────────────────────────────────────────────────

    def create_material_lesson
      source = resolve_owned(material_id, relation: :materials, label: "material")
      return source if source.failure?
      source = source.value!

      unless source.parsed? && source.sections.present?
        return Failure(:VALIDATION_FAILED,
                       { message: "the lesson source must be a parsed material with sections", field: :materialId })
      end
      if source.generated?
        return Failure(:VALIDATION_FAILED,
                       { message: "a generated lesson is never a generation source — generate from your own uploaded materials",
                         field: :materialId })
      end

      # The per-source singleton: this material already owns a lesson →
      # return it (the Materials-row action becomes "open the lesson").
      existing = current_user.materials.where(origin: "generated").find do |lesson|
        lesson.generation.is_a?(Hash) &&
          lesson.generation["variant"] == Ai::Lessons::VARIANT_MATERIAL &&
          Array(lesson.generation["sourceMaterialIds"]) == [ source.id ]
      end
      return Success(material: existing) if existing

      chapters = validate_echo(source)
      return chapters if chapters.failure?

      Success(material: persist_lesson(
        variant: Ai::Lessons::VARIANT_MATERIAL,
        title: source.title,
        plan_id: source.plan_id,
        attachment_scope: "plan",
        node: nil,
        source_material_ids: [ source.id ],
        chapters: chapters.value!
      ))
    end

    # The echoed outline re-validation (the confirm mutation trusts nothing
    # the wire carried): an Array of 1..MATERIAL_MAX_SECTIONS well-formed
    # chapters — present unique titles, ≥1 source id that EXISTS on the
    # source material (per-chapter deduped). Any violation is a shape
    # refusal — the propose gate already normalized; a bad echo means the
    # wire diverged, never a silent repair.
    def validate_echo(source)
      unless outline.is_a?(Array) && outline.any? && outline.length <= Ai::Lessons::MATERIAL_MAX_SECTIONS
        return Failure(:VALIDATION_FAILED,
                       { message: "the echoed outline must carry 1–#{Ai::Lessons::MATERIAL_MAX_SECTIONS} chapters — confirm the proposed outline",
                         field: :outline })
      end

      titles = []
      chapters = outline.each_with_index.map do |chapter, index|
        return Failure(:VALIDATION_FAILED,
                       { message: "outline chapter #{index + 1} must carry a title and source sections", field: :outline }) unless chapter.is_a?(Hash)

        title = (chapter[:title] || chapter["title"]).to_s.strip
        ids = Array(chapter[:source_section_ids] || chapter[:sourceSectionIds] || chapter["sourceSectionIds"]).uniq
        invalid = ids.empty? || ids.any? { |id| Ai::ContextAssembler.section_by_id(source, id).nil? }
        return Failure(:VALIDATION_FAILED,
                       { message: "outline chapter #{index + 1} names sections the source material does not have",
                         field: :outline }) if title.empty? || invalid
        return Failure(:VALIDATION_FAILED,
                       { message: "outline chapter titles must be unique", field: :outline }) if titles.include?(title)

        titles << title
        { title: title,
          anchors: ids.map { |id| { "materialId" => source.id, "sectionId" => id } },
          material_ids: [ source.id ] }
      end
      Success(chapters)
    end

    # The ONE write path — the generated Material row (sections empty; the
    # stream op fills them per section). The id IS the client uuid (the
    # delta-3 replay-exact posture). The generation jsonb is the reader's
    # live state (spec decision 2): variant, source pool (origin=uploaded
    # materials only — the 源池排他 law), outline placeholders, no pause.
    def persist_lesson(variant:, title:, plan_id:, attachment_scope:, node:, source_material_ids:, chapters:)
      Material.create!(
        id: client_uuid.to_s,
        user: current_user,
        plan_id: plan_id,
        attachment_scope: attachment_scope,
        node: node,
        title: title,
        kind: "markdown",
        size_bytes: 0,
        parse_state: "parsed",
        origin: "generated",
        sections: [],
        generation: {
          "variant" => variant,
          "sourceMaterialIds" => source_material_ids,
          "outline" => Ai::Lessons.outline_placeholder(chapters),
          "pausedKind" => nil,
          "generatedAt" => Time.current.iso8601
        }
      )
    end

    def internal_outline_failure
      Failure(:INTERNAL, { message: "ai lesson outline payload had no usable chapters" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's material", field: :clientUuid })
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end
  end
end
