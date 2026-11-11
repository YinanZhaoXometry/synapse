# frozen_string_literal: true

module Ai
  # The generated-lesson template (epic-36 T1, spec decision 10): the call
  # ceilings for both entry shapes live HERE and nowhere else — the prompts,
  # commands, stream op, and the estimate function all read the same
  # constants, so a ceiling change moves every surface at once (never a
  # hand-written cost table).
  #
  # The two shapes (spec §Solution):
  #   node     — ② 节点讲义: one plan node's confirmed mapped sections; the
  #              outline (1 call) lands at CreateLesson, then 4–6 section
  #              fills stream per section.
  #   material — ① 材料讲义: a whole uploaded material; the outline gate
  #              (propose, 1 call, stateless) precedes creation, then ≤ 8
  #              section fills stream per section.
  #
  # `estimate` derives the expected call band from the constants — the
  # entry pages and the outline confirm page share this ONE source
  # (FR-16's numbers come from server truth, never a UI table). An exact
  # outline size pins both ends; the node variant's section count is a
  # template property (4–6), not an input.
  module Lessons
    VARIANT_NODE = "node"
    VARIANT_MATERIAL = "material"
    VARIANTS = [ VARIANT_NODE, VARIANT_MATERIAL ].freeze

    # ② 硬顶模板: outline 1 + 小节 4–6 (spec decision 10).
    NODE_OUTLINE_CALLS = 1
    NODE_SECTION_MIN = 4
    NODE_SECTION_MAX = 6

    # ① 硬顶模板: outline 1 (the propose gate) + 小节 ≤ 8.
    MATERIAL_OUTLINE_CALLS = 1
    MATERIAL_MAX_SECTIONS = 8

    # The generation.outline chapter lifecycle (spec decision 2) and the
    # pause vocabulary (spec decision 9) — pinned vocabularies, twice
    # enforced (model/command seams + the jsonb contents).
    OUTLINE_STATUSES = %w[pending generating ready failed].freeze
    PAUSED_KINDS = [ "cap", "provider" ].freeze

    Estimate = Struct.new(:outline_calls, :sections_min, :sections_max, :total_min, :total_max, keyword_init: true)

    class << self
      def estimate(variant:, section_count: nil)
        case variant.to_s
        when VARIANT_NODE
          outline = NODE_OUTLINE_CALLS
          Estimate.new(outline_calls: outline, sections_min: NODE_SECTION_MIN, sections_max: NODE_SECTION_MAX,
                       total_min: outline + NODE_SECTION_MIN, total_max: outline + NODE_SECTION_MAX)
        when VARIANT_MATERIAL
          outline = MATERIAL_OUTLINE_CALLS
          if section_count
            sections = section_count.to_i.clamp(0, MATERIAL_MAX_SECTIONS)
            Estimate.new(outline_calls: outline, sections_min: sections, sections_max: sections,
                         total_min: outline + sections, total_max: outline + sections)
          else
            Estimate.new(outline_calls: outline, sections_min: 1, sections_max: MATERIAL_MAX_SECTIONS,
                         total_min: outline + 1, total_max: outline + MATERIAL_MAX_SECTIONS)
          end
        end
      end

      # The outline placeholder rows (spec decision 2): ids are server-minted
      # by position (never client-trusted), anchors verbatim (string-keyed
      # jsonb rows), every chapter starts `pending` — the stream op flips
      # each to `ready` the moment its section lands.
      def outline_placeholder(chapters)
        Array(chapters).each_with_index.map do |chapter, index|
          {
            "id" => "ch-#{index + 1}",
            "title" => chapter[:title].to_s,
            "anchors" => Array(chapter[:anchors]).map(&:stringify_keys),
            "status" => "pending"
          }
        end
      end

      # The shared reply normalization for MATERIAL-grounded outlines (spec
      # decisions 5+8): well-formed chapters over REAL section ids survive —
      # title present, ≥1 source id the material actually carries
      # (per-chapter deduped), unusable chapters drop, the template cap
      # holds. Consumers: the propose gate (①) and the stream op's in-stream
      # outline for a material-variant lesson.
      def normalize_material_outline(raw, material, cap: MATERIAL_MAX_SECTIONS)
        payload = Ai::ResponseParser.extract_json_object(raw)
        return [] unless payload

        parsed = JSON.parse(payload)
        candidates = parsed.is_a?(Hash) ? parsed["chapters"] : nil
        return [] unless candidates.is_a?(Array)

        candidates.filter_map do |chapter|
          next unless chapter.is_a?(Hash)

          title = chapter["title"].to_s.strip
          ids = Array(chapter["sourceSectionIds"]).select { |id| Ai::ContextAssembler.section_by_id(material, id) }.uniq
          next if title.empty? || ids.empty?

          { "title" => title, "sourceSectionIds" => ids }
        rescue StandardError
          next
        end.first(cap)
      end

      # The shared reply normalization for NODE-grounded outlines (②): the
      # node's CONFIRMED mapped sections are the only usable ids — each kept
      # id maps to the mapping row's material, and the chapter carries the
      # anchors (materialId+sectionId) plus the resolved source-material ids
      # the generation jsonb needs. Consumers: CreateLesson's internal
      # outline and the stream op's in-stream outline for a node-variant
      # lesson.
      def normalize_node_outline(raw, node, cap: NODE_SECTION_MAX)
        payload = Ai::ResponseParser.extract_json_object(raw)
        return [] unless payload

        parsed = JSON.parse(payload)
        candidates = parsed.is_a?(Hash) ? parsed["chapters"] : nil
        return [] unless candidates.is_a?(Array)

        pairs = node_confirmed_pairs(node)
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
        end.first(cap)
      end

      # THIS node's confirmed section→material pairs for the ENGINE (spec
      # decision 8's 后端半边): the confirmed section→material pairs the
      # outline normalization accepts, built over node_engine_rows — a pair
      # survives only when its section still resolves on an UPLOADED material
      # (a generated lesson never grounds a lesson).
      def node_confirmed_pairs(node)
        node_engine_rows(node)
          .filter_map { |row| [ row.section_id, row.material ] if row.material && Ai::ContextAssembler.section_by_id(row.material, row.section_id) }
          .to_h
      end

      # The engine's confirmed mapping rows (the 源池排他 half the mapping
      # path needs): node_teaching_mappings MINUS generated lessons. The
      # TEACHING path (epic-34's AI 讲解) reads the unfiltered query —
      # teaching ≠ engine; the engine filters at its own read, so a lesson
      # manually mapped onto a node can never feed another lesson (the
      # server-side mapping refusal stays deferred defense-in-depth).
      def node_engine_rows(node)
        Ai::ContextAssembler.node_teaching_mappings(node.plan, node)
                            .reject { |row| row.material&.origin == "generated" }
      end
    end
  end
end
