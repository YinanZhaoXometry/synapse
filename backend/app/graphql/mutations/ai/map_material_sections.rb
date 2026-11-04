# frozen_string_literal: true

module Mutations
  module Ai
    # mapMaterialSections (FR-45, epic P2-10 T1; delta decisions 3+4): run
    # the AI mapping for one parsed, plan-attached material — thin per
    # AD-12: parse → authorize (current_user!) → command → map. The command
    # owns the whole contract (the AD-16 cap-counted provider call, the
    # coverage guarantee — every section lands proposed/confirmed/rejected —
    # and the never-overwrite/never-re-propose state machine). The payload
    # returns the material's mapping rows in section order; the coverage
    # panel refetches through the materialNodeMappings read anyway. Lives in
    # the Ai namespace with its sibling AI mutations — it is the one AI
    # command of the mapping surface.
    class MapMaterialSections < BaseMutation
      description "Run AI section→node mapping for one parsed, plan-attached material (FR-45, epic P2-10 T1): every section lands in exactly one state — proposed onto an existing node, proposed under a new node title for a coverage gap, or the explicit Unmapped row. Confirmed rows are never overwritten; rejected sections are never re-proposed. One AI call per run (the daily cap counts it)."

      argument :material_id, String,
               required: true,
               description: "The material's uuid (ownership-checked; must be parsed with sections and attached to a plan)."

      argument :language, String,
               required: true,
               description: "The proposed-node-title language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."

      field :mappings, [ Types::MaterialNodeMappingType ],
            null: false,
            description: "The material's mapping rows after the run, in the sections' document order."

      def resolve(material_id:, language:)
        command_result(::Ai::MapMaterialSectionsCommand.call(
          current_user: current_user!,
          material_id: material_id,
          language: language
        ))
      end
    end
  end
end
