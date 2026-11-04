# frozen_string_literal: true

module Ai
  # Context assembly (AD-16 / AD-5, epic P2-5 ticket 01): everything an AI
  # prompt is grounded on is loaded from Postgres here — never trusted from
  # the client. Three variants: plan scope (all attached materials, the
  # generation surface for quiz/flashcards on a plan), task scope (a Study
  # Task's single material), and companion grounding (the ReadingPosition
  # chat surface). The streamed surfaces receive the assembled text through
  # the stream ticket (ticket 04); the mutations assemble at command time.
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

    class << self
      def default_budget
        positive_int(ENV["AI_CONTEXT_BUDGET_TOKENS"]) || DEFAULT_CONTEXT_BUDGET_TOKENS
      end

      def estimate_tokens(text)
        (text.to_s.length / CHARS_PER_TOKEN).ceil
      end

      # A plan's nodes (attribution targets, AD-6) + every attached
      # material's sections, in stable order (nodes by `order`, materials by
      # attach time).
      def plan_scope(plan, budget: default_budget)
        nodes = plan.knowledge_nodes.order(:order, :id)
        materials = Material.where(plan_id: plan.id).order(:created_at, :id)
        assemble_scope(nodes_block(nodes), materials, budget)
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

      # Companion grounding (AD-5): the section under the ReadingPosition
      # locator in full focus, then the material's section index so the
      # model can cite other sections it saw. The position's own quoted text
      # rides first, budget permitting.
      def companion_grounding(material, position, budget: default_budget)
        locator = position["locator"] || {}
        focus_id = section_id_for(locator)
        position_text = position["text"].to_s

        parts = +""
        truncated = false
        consumed = 0

        unless position_text.empty?
          block = "[reading position]\n#{position_text}\n\n"
          tokens = estimate_tokens(block)
          if tokens <= budget
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

      def assemble_scope(nodes_text, materials, budget)
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

          Array(material.sections).each do |section|
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
        "[section id=#{section["id"]} title=\"#{section["title"]}\"]\n#{section_text(section)}\n\n"
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
