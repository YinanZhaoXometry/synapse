# frozen_string_literal: true

module Ai
  # ProposeLessonOutline (epic-36 T1, spec decision 5 — ① 材料讲义's outline
  # gate): a parsed, section-bearing material becomes a chapter outline —
  # the cheap, read-only preview (chapters + each chapter's source sections
  # + the exact estimate) the learner confirms before anything is written.
  # STATELESS by contract: nothing persists (the outline rides the confirm
  # mutation back as the echoed outline), so a re-roll ("重出一版") is simply
  # one more cap-counted call.
  #
  # Gate (nothing is spent on a refusal): the material must be the caller's
  # (uniform NOT_FOUND — never an existence leak), PARSED with ≥1 section
  # (the Materials-row action's server-side mirror), and NOT itself
  # generated — a lesson is never a generation source (spec decision 8, the
  # 源池排他 law's gate half; the stream/commands enforce it too).
  #
  # One Provider.complete call over ContextAssembler.material_scope (the
  # material's own sections, budget-sliced — the grounding is the material,
  # nothing else). The reply normalizes server-side: chapters need a title
  # and ≥1 source section id that EXISTS on the material (per-chapter
  # deduped), unusable chapters drop, the template cap
  # (Ai::Lessons::MATERIAL_MAX_SECTIONS) holds, zero survivors → INTERNAL
  # (a provider-contract violation, never a user mistake). The estimate
  # rides the SAME template constants (spec decision 10 — no hand-written
  # cost table).
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND; cap
  # → CAP_REACHED (passed through from the seam).
  class ProposeLessonOutlineCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :language

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)

      material = resolve_material
      return material if material.failure?

      provider = Ai::Provider.complete(user: current_user,
                                       messages: Ai::Prompts.lesson_outline(
                                         language: language,
                                         context: Ai::ContextAssembler.material_scope(material.value!),
                                         material_title: material.value!.title
                                       ))
      return provider if provider.failure?

      chapters = Ai::Lessons.normalize_material_outline(provider.value!, material.value!)
      return internal_payload_failure if chapters.empty?

      Success(outline: chapters,
              estimated_calls: Ai::Lessons.estimate(variant: Ai::Lessons::VARIANT_MATERIAL,
                                                    section_count: chapters.length).total_min)
    end

    private

    # The gate: uniform NOT_FOUND for foreign/malformed ids, then the
    # parsed∧sections refusal, then the 源池排他 refusal — all BEFORE any
    # provider call.
    def resolve_material
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material
      return Failure(:VALIDATION_FAILED,
                     { message: "the lesson outline needs a parsed material with sections", field: :materialId }) unless material.parsed? && material.sections.present?
      if material.generated?
        return Failure(:VALIDATION_FAILED,
                       { message: "a generated lesson is never a generation source — propose from your own uploaded materials",
                         field: :materialId })
      end

      Success(material)
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai lesson outline payload had no usable chapters" })
    end
  end
end
