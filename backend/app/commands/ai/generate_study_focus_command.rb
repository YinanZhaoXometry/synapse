# frozen_string_literal: true

module Ai
  # GenerateStudyFocus (FR-17, epic-13 T4; OQ-1): a synchronous generation
  # mutation through the adapter — the GenerateNoteCommand shape (assemble
  # the context server-side, ONE cap-counted provider call, persist the
  # reply). The distillation source is the material's OWN annotations (the
  # gate: fewer than one → VALIDATION_FAILED honestly — there is nothing to
  # distill; the frontend hides the action anyway), riding the context
  # FIRST with the section index after (coherence only — Prompts.studyFocus
  # tells the model the index is never a content source, NFR-1).
  #
  # Replay-before-spend (delta 3): the client-supplied uuid is the replay
  # key of the set's LAST generation (stored on the row, globally unique).
  # An owned uuid returns the existing set WITHOUT a provider call (a
  # timeout retry never spends two cap calls) — checked BEFORE the
  # annotation gate, so a retry stays safe even if the annotations changed
  # between the attempt and its retry. A uuid owned by a different user →
  # VALIDATION_FAILED before anything is spent. Regeneration replaces the
  # key along with the items — an older generation is deliberately no
  # longer addressable (no forked history v1).
  #
  # Storage shape (recorded on the ticket): ONE active set per user+material
  # (`study_focus_sets`, the unique index is the law) — regeneration
  # updates the row's items in place and bumps `generation` (the wire's vN
  # chip). Items jsonb = [{ id, title, detail, sourceRange }] — the item
  # ids are server-minted (the flashcards posture) and sourceRange is the
  # annotation's range jsonb VERBATIM (the deep-link shape; the AD-2
  # mapping stays server-owned — the model never echoes an address back).
  #
  # The index map: the reply's sourceAnnotationIndex (1-based, the
  # [annotation N] prompt vocabulary) resolves through the SERVER's
  # annotation list. A non-Integer index or one outside 1..count DROPS the
  # item — an honest count landing below the target, never an invented
  # address. A range-less (pre-T3 import) annotation resolves sourceRange
  # to nil — the item rides text-only, honestly unlinkable.
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND
  # (the material resolves through current_user uniformly — malformed,
  # unknown, and foreign ids answer the same NOT_FOUND); cap → CAP_REACHED
  # (passed through from the seam); a provider reply with zero usable
  # items → INTERNAL (a provider-contract violation, not a user mistake).
  class GenerateStudyFocusCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :language
    option :material_id

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      resolved_material = resolve_material
      return resolved_material if resolved_material.failure?
      material = resolved_material.value!

      # Replay-before-spend (the GenerateNote posture): an owned uuid
      # returns the existing set untouched; a foreign uuid is
      # VALIDATION_FAILED. Ahead of the annotation gate — a retry must
      # never refuse where its original attempt succeeded.
      existing = StudyFocusSet.find_by(client_uuid: client_uuid.to_s)
      return cross_user_uuid_failure if existing && existing.user_id != current_user.id
      return Success(study_focus_set: existing) if existing

      annotations = current_user.annotations.where(material_id: material.id).order(:created_at, :id).to_a
      return annotation_gate_failure if annotations.empty?

      context = Ai::ContextAssembler.annotation_scope(material, annotations)
      provider = Ai::Provider.complete(user: current_user,
                                       messages: Ai::Prompts.study_focus(language: language, context: context))
      return provider if provider.failure?

      items = normalize_items(provider.value!, annotations)
      return internal_payload_failure if items.empty?

      Success(study_focus_set: persist_set(material, items))
    end

    private

    # The material through the owner's association path — malformed,
    # unknown, and foreign ids answer the uniform NOT_FOUND (AD-13, never
    # an existence leak).
    def resolve_material
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material

      Success(material)
    end

    # Only usable title/detail pairs survive (the flashcards normalize
    # posture — one hallucinated half-item must not cost the user their
    # generation), and each survivor's sourceAnnotationIndex resolves
    # through the SERVER-owned map or the item is dropped.
    def normalize_items(raw, annotations)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return [] unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["items"] : nil
      return [] unless candidates.is_a?(Array)

      candidates.filter_map do |item|
        next unless item.is_a?(Hash)
        title = item["title"].to_s.strip
        detail = item["detail"].to_s.strip
        next if title.empty? || detail.empty?

        source_range = source_range_for(item["sourceAnnotationIndex"], annotations)
        next if source_range == :drop

        { "id" => SecureRandom.uuid, "title" => title, "detail" => detail, "sourceRange" => source_range }
      end
    end

    # The server-owned index map: a strict Integer 1..count resolves to
    # that annotation's range jsonb verbatim (nil for a range-less row);
    # anything else drops the item (nil :drop sentinel below).
    def source_range_for(index, annotations)
      return :drop unless index.is_a?(Integer) && index.positive? && index <= annotations.count

      annotations[index - 1].range
    end

    # The one write path (no pre-existing Study Focus command): one active
    # row per user+material — the first generation creates it at
    # generation 1, every regeneration updates it in place and bumps the
    # counter. The replay key follows the items (the set's LAST generation
    # is the addressable one).
    def persist_set(material, items)
      set = StudyFocusSet.find_by(user: current_user, material: material)
      if set
        set.update!(items: items, client_uuid: client_uuid.to_s, generation: set.generation + 1)
      else
        set = StudyFocusSet.create!(user: current_user, material: material, items: items,
                                    client_uuid: client_uuid.to_s, generation: 1)
      end
      set
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai study focus payload had no usable items" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's study focus set", field: :clientUuid })
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end

    def annotation_gate_failure
      Failure(:VALIDATION_FAILED,
              { message: "the material has no annotations to distill — highlight first", field: :materialId })
    end
  end
end
