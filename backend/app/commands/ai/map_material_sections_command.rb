# frozen_string_literal: true

module Ai
  # MapMaterialSections (FR-45, epic P2-10 T1; delta decisions 3+4): map one
  # plan-attached material's sections onto the plan's knowledge nodes —
  # existing-node mappings AND proposed new-node titles for coverage gaps —
  # and land EVERY section in exactly one final state as
  # material_node_mappings rows. Nothing is silently dropped: a section the
  # model cannot confidently place becomes a proposed row — grouped under a
  # proposed_node_title when a coverage gap has a name, or the explicit
  # Unmapped row (node + title both null) when it does not.
  #
  # In-place state machine (delta decision 4 — ONE ACTIVE row per
  # user+material+section, the unique index): `confirmed` rows are NEVER
  # overwritten and `rejected` sections are NEVER re-proposed (the user's
  # decisions stand; a re-run touches only the still-open sections).
  # `proposed` rows may be updated in place by a later run.
  #
  # AD-16 posture: one cap-counted provider call through the seam, context
  # assembled server-side (the full section index rides whole even when the
  # section texts hit the budget — the coverage contract needs every section
  # id addressable). Failure surface: language/material-arg problems →
  # VALIDATION_FAILED / NOT_FOUND before anything is spent; cap →
  # CAP_REACHED (passed through); a reply with NO parseable mappings →
  # INTERNAL (a provider-contract violation). Individual garbage entries are
  # DROPPED — their sections still get Unmapped rows, so a hallucinated
  # nodeId costs coverage clarity, never the contract.
  class MapMaterialSectionsCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :language

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material
      return Failure(:VALIDATION_FAILED, { message: "material has no parsed sections to map", field: :materialId }) if Array(material.sections).empty?
      return Failure(:VALIDATION_FAILED, { message: "material is not attached to a plan", field: :materialId }) unless material.plan_id

      plan = current_user.study_plans.find_by(id: material.plan_id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      context = Ai::ContextAssembler.mapping_scope(plan, material)
      messages = Ai::Prompts.mapping(language: language, context: context)
      provider = Ai::Provider.complete(user: current_user, messages: messages)
      return provider if provider.failure?

      targets = normalize_targets(provider.value!, material, plan)
      return internal_payload_failure if targets.nil?

      Success(mappings: upsert_rows(material, targets))
    end

    private

    # section_id → { node_id:, proposed_node_title: } for the model's usable
    # entries. Hallucinated node ids, unknown section ids, and non-hash
    # entries are dropped (their sections land as Unmapped rows in the
    # upsert). A nodeId beats a proposedNodeTitle on the same entry.
    def normalize_targets(raw, material, plan)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return nil unless payload

      parsed = JSON.parse(payload)
      candidates = parsed.is_a?(Hash) ? parsed["mappings"] : nil
      return nil unless candidates.is_a?(Array)

      node_ids = plan.knowledge_nodes.index_by(&:id)
      section_ids = Array(material.sections).map { |section| section["id"] }

      targets = {}
      candidates.each do |entry|
        next unless entry.is_a?(Hash)
        section_id = entry["sectionId"].to_s
        next unless section_ids.include?(section_id)

        node = node_ids[entry["nodeId"]]
        title = entry["proposedNodeTitle"].to_s.strip
        title = nil if title.empty?
        if node
          targets[section_id] = { node_id: node.id, proposed_node_title: nil }
        elsif title
          targets[section_id] = { node_id: nil, proposed_node_title: title }
        end
      rescue StandardError
        next
      end
      targets
    end

    # The one write path — the in-place state machine (delta decision 4).
    # Confirmed/rejected rows stand untouched; every other section gets
    # exactly one proposed row (existing → updated in place, missing →
    # created). Returns the material's rows in the sections' document order.
    def upsert_rows(material, targets)
      ActiveRecord::Base.transaction do
        existing = current_user.material_node_mappings
                               .where(material_id: material.id)
                               .index_by(&:section_id)
        Array(material.sections).each do |section|
          row = existing[section["id"]]
          next if row&.confirmed? || row&.rejected?

          target = targets[section["id"]]
          row ||= MaterialNodeMapping.new(user_id: current_user.id, material_id: material.id,
                                          section_id: section["id"])
          row.node_id = target&.dig(:node_id)
          row.proposed_node_title = target&.dig(:proposed_node_title)
          row.status = :proposed
          row.save!
        end
      end

      index = current_user.material_node_mappings.where(material_id: material.id).index_by(&:section_id)
      Array(material.sections).filter_map { |section| index[section["id"]] }
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai mapping payload had no usable mappings" })
    end
  end
end
