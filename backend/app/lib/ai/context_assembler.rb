# frozen_string_literal: true

module Ai
  # Context assembly (AD-16 / AD-5, epic P2-5 ticket 01): everything an AI
  # prompt is grounded on is loaded from Postgres here — never trusted from
  # the client. Four variants: plan scope (the PLAN-WIDE materials — FR-44's
  # enforcement point since epic P2-10 T2: node-pinned materials never ride),
  # node scope (one node's plan-wide + own-pinned materials), task scope (a
  # Study Task's single material), and companion grounding (the
  # ReadingPosition chat surface). The streamed surfaces receive the
  # assembled text through the stream ticket (ticket 04); the mutations
  # assemble at command time.
  #
  # Bounding is deterministic (ticket 02's ~8k context-in budget, NFR-4):
  # whole sections are included in a stable order while they fit; when
  # nothing fits yet, the FIRST candidate section is hard-truncated to the
  # remaining budget and marked — text is never silently cut, and a
  # `truncated` flag lets prompts/consumers know the context is partial.
  # Token counts are estimated at a fixed conservative ratio (3 chars/token,
  # zh-heavy safe), not a provider tokenizer — the bound is a coarse ceiling,
  # and determinism beats precision here.
  class ContextAssembler
    DEFAULT_CONTEXT_BUDGET_TOKENS = 8_000
    CHARS_PER_TOKEN = 3.0
    TRUNCATION_MARKER = " …[truncated]"

    # `text` is the prompt-ready context; `truncated` is true when anything
    # was dropped or cut.
    Assembled = Struct.new(:text, :truncated, keyword_init: true)

    # The node-teaching grounding result (epic-34 T2, AI 讲解): the assembled
    # context plus `unmapped` — the honesty flag (no USABLE confirmed mapping)
    # the plan-companion prompt's honesty directive reads. A distinct struct,
    # not an Assembled extension: the teaching turn's honesty posture is
    # assembly-derived here, never re-derived by its consumers.
    NodeGrounding = Struct.new(:text, :truncated, :unmapped, keyword_init: true)

    # The teaching turn's directive facts (epic-34 T2 review round): the node
    # being taught + the grounding's honesty posture, traveling as a value —
    # never a bare hash — from the stream controller through
    # Prompts.plan_companion into the teaching directive.
    TeachingNode = Struct.new(:title, :unmapped, keyword_init: true)

    class << self
      def default_budget
        positive_int(ENV["AI_CONTEXT_BUDGET_TOKENS"]) || DEFAULT_CONTEXT_BUDGET_TOKENS
      end

      def estimate_tokens(text)
        (text.to_s.length / CHARS_PER_TOKEN).ceil
      end

      # A plan's nodes (attribution targets, AD-6) + every PLAN-WIDE attached
      # material's sections, in stable order (nodes by `order`, materials by
      # attach time). FR-44 enforcement (epic P2-10 T2, AD-16): ONLY
      # plan-scoped materials ride here — a node-pinned material's sections
      # feed its node alone (node_scope) and are provably absent from this
      # surface.
      def plan_scope(plan, budget: default_budget)
        nodes = plan.knowledge_nodes.order(:order, :id)
        materials = Material.where(plan_id: plan.id, attachment_scope: "plan").order(:created_at, :id)
        assemble_scope(nodes_block(nodes), materials, budget)
      end

      # One node's grounding + quiz generation surface (FR-44, epic P2-10 T2)
      # — the primitive node-scoped surfaces and T5's targeted generation
      # consume. The nodes block carries THE single node; the materials pool
      # is the plan-wide pool PLUS this node's own pinned materials, in one
      # stable attach-time order. Another node's pinned material never
      # enters: pinned content stays with its node unless it is plan-wide.
      def node_scope(plan, node, budget: default_budget)
        materials = Material.where(plan_id: plan.id, attachment_scope: "plan")
                            .or(Material.where(plan_id: plan.id, attachment_scope: "node", node_id: node.id))
                            .order(:created_at, :id)
        assemble_scope(nodes_block([ node ]), materials, budget)
      end

      # A Study Task's single auto-node + its material.
      def task_scope(task, budget: default_budget)
        assemble_scope(nodes_block([ task.node ]), Material.where(id: task.material_id), budget)
      end

      # One material, no nodes (the flashcard-deck surface: the deck IS the
      # material's sections — FR-19).
      def material_scope(material, budget: default_budget)
        assemble_scope("", Material.where(id: material.id), budget)
      end

      # One material's Quick Test surface (FR-14, epic-13 T2): the caller's
      # mapped nodes ride as the [nodes] block (the prompt's nodeId vocabulary
      # — the command passes the CONFIRMED mappings' nodes, deduped), then the
      # material's sections — all of them, or narrowed to section_ids (the
      # Quick Test's selection/section targeting; the caller validates every
      # id exists on the material). Unmapped sections' content may still ride
      # for coherence — the prompt's attribution note owns which sections may
      # produce questions — but narrowing never invents ids.
      def quick_test_scope(nodes, material, section_ids: nil, budget: default_budget)
        assemble_scope(nodes_block(Array(nodes).uniq), Material.where(id: material.id), budget,
                       only: Array(section_ids).presence)
      end

      # The mapping surface (FR-45, epic P2-10 T1): a plan's full node list +
      # ONE attached material's sections. The section index is the
      # addressability backbone — every section id must stay answerable — so
      # its tokens are reserved FIRST and the body (nodes + bounded section
      # texts) assembles against what remains; the joining newline is a
      # token too (the estimate's ceil boundary). The assembled estimate
      # never exceeds the budget, as everywhere: when the index alone
      # exceeds the budget it is hard-truncated into it (marker + flag, the
      # honest cut) and the body rides out entirely — a body after an
      # over-budget index would overflow. When the index fits but leaves no
      # room for any body, the index rides alone and the dropped body marks
      # the assembly partial.
      def mapping_scope(plan, material, budget: default_budget)
        index = section_index_block(material)
        index_tokens = estimate_tokens(index)

        if index_tokens > budget
          cut, = hard_truncate(index, budget)
          return Assembled.new(text: cut, truncated: true)
        end

        body_budget = budget - index_tokens - (index_tokens.positive? ? 1 : 0)
        if body_budget <= 0
          return Assembled.new(text: index.strip, truncated: true)
        end

        body = assemble_scope(nodes_block(plan.knowledge_nodes.order(:order, :id)),
                              Material.where(id: material.id), body_budget)
        text = index_tokens.positive? ? [ body.text, index.strip ].reject(&:empty?).join("\n") : body.text
        Assembled.new(text: text, truncated: body.truncated)
      end

      # Plan grounding (FR-46, epic P2-12 T3): the plan-scope chat surface —
      # no ReadingPosition. With a mistake entry, its question (and the
      # learner's answer) ride FIRST, then the entry's source section — the
      # companion_grounding position-text pattern with the same locator
      # resolver (a mistake's source_location may be a pdf page or a
      # markdown sectionId). Then the bounded plan_scope text, then a
      # confirmed-mapping block (one line per confirmed node-attached row)
      # so node relationships are citable. Same budget discipline
      # throughout: whole blocks while they fit, hard-truncate when nothing
      # fits, the estimate never exceeds the budget, `truncated` honest.
      def plan_grounding(plan, mistake_entry: nil, budget: default_budget)
        parts = +""
        truncated = false
        consumed = 0

        if mistake_entry
          block = "[mistake entry]\n#{mistake_entry.question.prompt}\n"
          answer = mistake_entry.user_answer.to_s
          block += "learner's answer: #{answer}\n" unless answer.empty?
          block += "\n"
          tokens = estimate_tokens(block)
          if tokens <= budget - consumed
            parts << block
            consumed += tokens
          else
            consumed, = append_bounded(parts, "[mistake entry]\n", block, consumed, budget)
            truncated = true
          end

          material = mistake_entry.question.source_material
          section = material && section_by_id(material, section_id_for(mistake_entry.source_location || {}))
          if section
            block = render_section(section)
            tokens = estimate_tokens(block)
            remaining = budget - consumed
            if tokens <= remaining
              parts << block
              consumed += tokens
            else
              consumed, = append_bounded(parts, section_header(section), section_text(section), consumed, budget)
              truncated = true
            end
          end
        end

        # The plan scope rides after the mistake focus. The truncation
        # marker's tokens are reserved so a hard-cut scope never pushes the
        # assembly past the budget (+1 for the joining newline — a token too).
        remaining = budget - consumed
        reserve = estimate_tokens(TRUNCATION_MARKER) + 1
        if remaining > reserve
          scope = plan_scope(plan, budget: remaining - reserve)
          unless scope.text.empty?
            parts << scope.text << "\n"
            consumed += estimate_tokens(scope.text) + 1
          end
          truncated ||= scope.truncated
        end

        mapping = confirmed_mapping_block(plan)
        mapping_tokens = estimate_tokens(mapping)
        if mapping_tokens.positive? && consumed + mapping_tokens <= budget
          parts << mapping
        elsif mapping_tokens.positive?
          truncated = true
        end

        Assembled.new(text: parts.strip, truncated: truncated)
      end

      # Node teaching grounding (epic-34 T2, AI 讲解 — the plan-companion
      # stream's nodeId turns): THE single node — its nodes-block line plus
      # its description (the node's stated coverage, when the row carries
      # one) — then THIS node's confirmed mapped sections' text, budget
      # bounded. Deliberately NOT node_scope: the plan-wide materials pool
      # never rides a teaching turn (decision 6 — the turn is about this
      # node), and another node's pinned material stays with its node (the
      # FR-44 semantics, unchanged). The result's `unmapped` flag is the
      # honesty posture: Prompts.plan_companion reads it to say no material
      # is attached. It reflects USABLE mapped text, never row existence —
      # zero confirmed rows AND rows whose sections no longer resolve
      # (deleted/renumbered sections) both leave the context section-less,
      # and an empty context MUST read as unmapped so the honesty directive
      # fires: "teach from confirmed sections" with none present would be
      # the dishonest shape. Budget discipline is plan_grounding's: whole
      # sections while they fit, the honest hard cut (marker reserved) when
      # nothing fits, the estimate never exceeds the budget, `truncated`
      # honest.
      def node_grounding(plan, node, budget: default_budget)
        rows = node_teaching_mappings(plan, node)
        parts = +""
        truncated = false
        consumed = 0
        mapped_usable = false

        head = teaching_node_block(node)
        parts << head
        consumed += estimate_tokens(head)

        reserve = estimate_tokens(TRUNCATION_MARKER) + 1
        rows.each do |row|
          section = section_by_id(row.material, row.section_id)
          next unless section

          remaining = budget - consumed
          break if remaining <= reserve

          block = render_section(section)
          tokens = estimate_tokens(block)
          if tokens <= remaining
            parts << block
            consumed += tokens
            mapped_usable = true
          else
            consumed, appended = append_bounded(parts, section_header(section), section_text(section),
                                                consumed, budget)
            truncated = true
            mapped_usable ||= appended
            break
          end
        end

        NodeGrounding.new(text: parts.strip, truncated: truncated, unmapped: !mapped_usable)
      end

      # The teaching turn's confirmed mapping rows (epic-34 T2): THIS node's
      # confirmed rows on the plan's own materials, stable created_at/id
      # order (the confirmed_mapping_block discipline). The mapping itself is
      # the justification — a confirmed row on a node-pinned material teaches
      # this node too; the plan-wide/pinned scopes are irrelevant here.
      def node_teaching_mappings(plan, node)
        MaterialNodeMapping.where(user_id: plan.user_id, status: "confirmed", node_id: node.id)
                           .joins(:material).where(materials: { plan_id: plan.id })
                           .order(:created_at, :id).includes(:material)
      end

      # The single-node head block: the shared nodes_block line (id/stage/
      # order/title vocabulary) plus the node's description — the teaching
      # turn's title/description grounding (decision 6; the ER has no
      # separate objectives field, the description IS the node's stated
      # coverage). A legacy description-less node rides the plain block.
      def teaching_node_block(node)
        block = nodes_block([ node ])
        description = node.description.to_s.strip
        description.empty? ? block : "#{block}[node description] #{description}\n"
      end

      # The confirmed section→node relationships (epic-10's mapping read,
      # server-side): one line per node-attached confirmed row, so the model
      # can cite which material section feeds which node. Empty → "" (no
      # block — the prompt sees nothing it cannot ground).
      def confirmed_mapping_block(plan)
        rows = MaterialNodeMapping.where(user_id: plan.user_id, status: "confirmed")
                                  .joins(:node)
                                  .where(knowledge_nodes: { plan_id: plan.id })
                                  .order(:created_at, :id)
        lines = rows.filter_map do |row|
          next unless row.node_id && row.material

          "[node #{row.node.title}] ← [material #{row.material.title}] section #{row.section_id}"
        end
        return "" if lines.empty?

        lines.prepend("[confirmed mappings]")
        lines.join("\n") + "\n"
      end

      # Companion grounding (AD-5): the section under the ReadingPosition
      # locator in full focus, then the material's section index so the
      # model can cite other sections it saw. The position's own quoted text
      # rides first, budget permitting. With a selection (epic-13 T1's
      # FR-13 — the reader's selection bar asked), a [selection] block rides
      # FIRST — the tightest grounding wins the earliest tokens — with the
      # same budget discipline: whole while it fits, hard-cut with the
      # marker when nothing fits, `truncated` honest.
      def companion_grounding(material, position, selection: "", budget: default_budget)
        locator = position["locator"] || {}
        focus_id = section_id_for(locator)
        position_text = position["text"].to_s
        selection_text = selection.to_s.strip

        parts = +""
        truncated = false
        consumed = 0

        unless selection_text.empty?
          block = "[selection]\n#{selection_text}\n\n"
          tokens = estimate_tokens(block)
          if tokens <= budget - consumed
            parts << block
            consumed += tokens
          else
            header = "[selection]\n"
            header_tokens = estimate_tokens(header)
            remaining = budget - consumed
            if remaining > header_tokens + 1
              cut, cut_short = hard_truncate(selection_text, remaining - header_tokens - 1)
              parts << header << cut << "\n\n"
              truncated ||= cut_short
            end
            consumed = budget
            truncated = true
          end
        end

        unless position_text.empty?
          block = "[reading position]\n#{position_text}\n\n"
          tokens = estimate_tokens(block)
          if tokens <= budget - consumed
            parts << block
            consumed += tokens
          else
            # The block's own header and trailing newlines are budgeted
            # (1 token reserved for the padding) — the same invariant the
            # focus-section branch below keeps.
            header = "[reading position]\n"
            header_tokens = estimate_tokens(header)
            remaining = budget - consumed
            if remaining > header_tokens + 1
              cut, cut_short = hard_truncate(position_text, remaining - header_tokens - 1)
              parts << header << cut << "\n\n"
              truncated ||= cut_short
            end
            consumed = budget
            truncated = true
          end
        end

        focus = section_by_id(material, focus_id)
        if focus
          block = render_section(focus)
          tokens = estimate_tokens(block)
          remaining = budget - consumed
          if tokens <= remaining
            parts << block
            consumed += tokens
          else
            header = "[section id=#{focus["id"]} title=\"#{focus["title"]}\"]\n"
            header_tokens = estimate_tokens(header)
            remaining = budget - consumed
            if remaining > header_tokens + 1 # +1: the block's trailing newlines
              cut, cut_short = hard_truncate(section_text(focus), remaining - header_tokens - 1)
              parts << header << cut << "\n\n"
              truncated ||= cut_short
            end
            consumed = budget
            truncated = true
          end
        end

        index = section_index_block(material)
        index_tokens = estimate_tokens(index)
        if consumed + index_tokens <= budget
          parts << index
        else
          truncated = true
        end

        Assembled.new(text: parts.strip, truncated: truncated)
      end

      # The Study Focus surface (FR-17, epic-13 T4): the material's own
      # annotations ride FIRST — they ARE the distillation source of truth
      # (numbered [annotation N] lines carrying kind + address + quoted
      # span, so the reply's sourceAnnotationIndex maps back server-side) —
      # then the section index for coherence (the addresses the annotations
      # point into). The annotations are the scarce, load-bearing tokens:
      # when they alone exceed the budget they are hard-truncated honestly
      # (marker + flag) and the index rides out entirely; the index fills
      # whatever remains — whole, or hard-cut with the marker. The estimate
      # never exceeds the budget (the mapping_scope discipline).
      def annotation_scope(material, annotations, budget: default_budget)
        block = annotations_block(annotations)
        block_tokens = estimate_tokens(block)

        if block_tokens > budget
          cut, = hard_truncate(block, budget)
          return Assembled.new(text: cut, truncated: true)
        end

        index = section_index_block(material)
        index_tokens = estimate_tokens(index)
        return Assembled.new(text: block.strip, truncated: false) if index_tokens.zero?

        remaining = budget - block_tokens - (block_tokens.positive? ? 1 : 0) # the joining newline
        if index_tokens <= remaining
          Assembled.new(text: [ block, index ].join("\n").strip, truncated: false)
        elsif remaining.positive?
          cut, = hard_truncate(index, remaining)
          Assembled.new(text: [ block, cut ].join("\n").strip, truncated: true)
        else
          Assembled.new(text: block.strip, truncated: true)
        end
      end

      # Exact section lookup by id ("markdown slug" or "page-N" for PDFs —
      # the same ids questions cite as source_section_id).
      def section_by_id(material, section_id)
        Array(material.sections).find { |section| section["id"] == section_id }
      end

      def positive_int(raw)
        value = raw.to_s.strip.to_i
        value if value.positive?
      end

      private

      def assemble_scope(nodes_text, materials, budget, only: nil)
        parts = +""
        truncated = false
        consumed = estimate_tokens(nodes_text)
        parts << nodes_text

        materials.each do |material|
          head = "[material id=#{material.id} title=\"#{material.title}\"]\n"
          head_tokens = estimate_tokens(head)
          if consumed + head_tokens > budget
            truncated = true
            break
          end

          consumed += head_tokens
          parts << head

          sections = Array(material.sections)
          sections = sections.select { |section| only.include?(section["id"]) } if only
          sections.each do |section|
            block = render_section(section)
            tokens = estimate_tokens(block)
            remaining = budget - consumed
            if tokens <= remaining
              parts << block
              consumed += tokens
            else
              # Nothing would fit whole — cut the section at the remaining
              # budget so the context is never empty mid-material, and the
              # budget is now spent: later materials cannot fit. The block's
              # own header and trailing newlines are budgeted too (1 token
              # reserved for the padding), keeping the invariant: the
              # assembled text's token estimate never exceeds the budget.
              header = "[section id=#{section["id"]} title=\"#{section["title"]}\"]\n"
              header_tokens = estimate_tokens(header)
              if remaining > header_tokens + 1
                cut, cut_short = hard_truncate(section_text(section), remaining - header_tokens - 1)
                parts << header << cut << "\n\n"
                truncated ||= cut_short
              end
              consumed = budget
              truncated = true
              break
            end
          end
        end

        Assembled.new(text: parts.strip, truncated: truncated)
      end

      def nodes_block(nodes)
        lines = nodes.map { |node| "[node id=#{node.id} stage=#{node.stage} order=#{node.order}] #{node.title}" }
        lines.prepend("[nodes]")
        lines << "" if lines.any?
        lines.join("\n")
      end

      def render_section(section)
        "#{section_header(section)}#{section_text(section)}\n\n"
      end

      def section_header(section)
        "[section id=#{section["id"]} title=\"#{section["title"]}\"]\n"
      end

      # The truncate-packing step shared by the grounding surfaces (the
      # review round's dedupe): the whole block no longer fits, so its
      # header + a hard cut of the body ride while the remaining budget
      # allows (+1 reserved for the block's trailing padding), and the
      # budget is spent either way. Returns `[new_consumed, appended?]` —
      # the second value is the honest "some text landed" signal the
      # node_grounding usability flag reads (a cut too big for even its
      # header lands nothing).
      def append_bounded(parts, header, body_text, consumed, budget)
        header_tokens = estimate_tokens(header)
        remaining = budget - consumed
        if remaining > header_tokens + 1
          cut, = hard_truncate(body_text, remaining - header_tokens - 1)
          parts << header << cut << "\n\n"
          return [ budget, true ]
        end

        [ budget, false ]
      end

      def section_text(section)
        section["text"].to_s
      end

      def section_index_block(material)
        lines = Array(material.sections).map { |section| "[section id=#{section["id"]}] #{section["title"]}" }
        return "" if lines.empty?

        lines.prepend("[material id=#{material.id} title=\"#{material.title}\" sections index]")
        lines.join("\n") + "\n"
      end

      # The numbered annotation block (FR-17): one line per annotation —
      # kind, the address the range names (the locator's address backs a
      # range-less pre-T3 import row), the char offsets, and the quoted
      # span (the distillation's content ground). The 1-based numbering IS
      # the reply contract's sourceAnnotationIndex vocabulary — the command
      # maps it back server-side.
      def annotations_block(annotations)
        lines = Array(annotations).each_with_index.map do |annotation, index|
          range = annotation.range || {}
          locator = annotation.locator || {}
          address = if range["sectionId"] || locator["sectionId"]
            "markdown section #{range["sectionId"] || locator["sectionId"]}"
          else
            "pdf page #{range["page"] || locator["page"]}"
          end
          line = "[annotation #{index + 1}] kind=#{annotation.kind} #{address}"
          line += " offsets #{range["start"]}-#{range["end"]}" if range["start"] && range["end"]
          quote = range["quote"].to_s
          line += " quote \"#{quote}\"" unless quote.empty?
          line
        end
        return "" if lines.empty?

        lines.prepend("[annotations]")
        lines.join("\n")
      end

      def section_id_for(locator)
        kind = locator["kind"]
        if kind == "pdf"
          page = locator["page"]
          page ? "page-#{page}" : nil
        elsif kind == "markdown"
          locator["sectionId"]
        end
      end

      # Deterministic hard cut: floor(token_budget × CHARS_PER_TOKEN)
      # characters, marker appended, `(text, cut_short)` back.
      def hard_truncate(text, token_budget)
        return [ "", false ] unless token_budget.positive?

        max_chars = (token_budget * CHARS_PER_TOKEN).floor
        return [ text, false ] if text.length <= max_chars

        [ text[0, [ max_chars - TRUNCATION_MARKER.length, 1 ].max] + TRUNCATION_MARKER, true ]
      end
    end
  end
end
