# frozen_string_literal: true

module Api
  # The ONE non-GraphQL api surface (AD-16, epic P2-5 ticket 04):
  # GET /api/stream?ticket=…&op=… streams a Companion chat or a plan
  # proposal as Server-Sent Events.
  #
  # Auth is by TICKET ALONE (never the Authorization header — the browser's
  # EventSource cannot set headers): a bad, expired, consumed (replayed), or
  # op-mismatched ticket answers 401 UNAUTHORIZED and never retries. The
  # grounding inputs come from the ticket payload (kickoff delta 4), the
  # language from the same payload — one mint, one redeem, one generation.
  #
  # The event vocabulary IS the frozen contract (ticket 04's ## Comments —
  # epic-08's client consumes it verbatim):
  #   event: rung           data: {"intent":"explain","rung":"hint|answer","canEscalate":bool,"language":"zh|en"}
  #   event: token          data: {"text":"…"}                      (many, in order)
  #   event: citation       data: {"locator":{...},"quote":null}    (companion only)
  #   event: terminal       data: {"code":"OK"} | {"code":"<enum>"} (+ "proposal":{...} for the proposal op)
  # epic-36 T1 adds the lesson op's vocabulary (spec decision 6 — the
  # generated-lesson section fill; the event list per connection):
  #   event: outline_ready  data: {"outline":[{id,title,anchors,status}]}  (always first — the
  #                         current outline, generated in-stream when the row has none)
  #   event: section_start  data: {"sectionId":"…","title":"…"}     (per pending chapter)
  #   event: token          data: {"text":"…"}                      (the chapter's single-pass stream)
  #   event: section_ready  data: {"sectionId":"…"}                 (the chapter just persisted atomically)
  #   event: terminal       data: {"code":"OK"} | CAP_REACHED | INTERNAL | NOT_FOUND
  # Resume semantics (the DeepTutor posture on our SSE contract): ready
  # sections SKIP on a re-opened ticket (重开=只补欠账), each completed
  # section persists ATOMICALLY (断线不留半句 — a drop never leaves half a
  # section), CAP_REACHED / provider failure land pausedKind on the lesson
  # (cap | provider) with the generated sections preserved, and there is no
  # auto-resume — continuing = an explicit new ticket.
  # The rung is request-derived server-side (escalated → "answer", else
  # "hint" — the ladder amendment); citations are derived from the grounded
  # position (the focus section) — the AD-5 contract is produced here, never
  # guessed client-side. No resume buffering: a drop means the client mints
  # a fresh ticket and restarts (counted against the cap, AD-16).
  class StreamController < ActionController::API
    include ActionController::Live

    def show
      redeemed = StreamTicket.redeem(params[:ticket], params[:op])
      return respond_unauthorized unless redeemed

      user = User.find_by(id: redeemed.user_id)
      return respond_unauthorized unless user

      write_sse_headers
      payload = redeemed.payload
      if redeemed.op == "proposal"
        stream_proposal(user, payload)
      elsif redeemed.op == "plan_companion"
        stream_plan_companion(user, payload)
      elsif redeemed.op == "lesson"
        stream_lesson(user, payload)
      else
        stream_companion(user, payload)
      end
    rescue StandardError => e
      # Headers may or may not be out yet — try the terminal event, then
      # close; the client sees the failure as a terminal, not a hang.
      begin
        terminal(code: "INTERNAL")
      rescue StandardError
        nil
      end
    ensure
      response.stream.close
    end

    private

    def respond_unauthorized
      render json: { "code" => "UNAUTHORIZED" }, status: :unauthorized
    end

    def write_sse_headers
      response.headers["Content-Type"] = "text/event-stream"
      response.headers["Cache-Control"] = "no-cache"
      response.headers["X-Accel-Buffering"] = "no"
    end

    def sse(event, data)
      response.stream.write("event: #{event}\ndata: #{JSON.generate(data)}\n\n")
    rescue ActionController::Live::ClientDisconnected
      # The client dropped — the generation keeps costing (deliberate,
      # AD-16) but there is nothing left to write to.
      throw :client_gone
    end

    def terminal(code:, proposal: nil)
      data = { "code" => code }
      data["proposal"] = proposal if proposal
      write_safely { sse("terminal", data) }
    end

    # Writes that may land after the client already dropped: swallow the
    # disconnect (the generation's cost was already paid — AD-16) instead of
    # throwing into a context that has no catch handler.
    def write_safely
      yield
    rescue ActionController::Live::ClientDisconnected
      nil
    end

    # One provider stream mapped onto token events. Returns nil on success
    # or the typed Failure value (INTERNAL for transport faults — the cap
    # trips BEFORE any enumerator exists, so CAP_REACHED arrives as a
    # Failure too).
    def stream_to_tokens(user, messages, on_delta)
      result = Ai::Provider.stream(user: user, messages: messages)
      if result.failure?
        # The failure paths are silent on the wire by contract (terminal
        # enum only) — the log is the only diagnosability (2026-11-10: two
        # live proposal failures were invisible without it).
        Rails.logger.warn("[ai] stream failure: #{result.failure.code} — #{result.failure.context[:message]}")
        return result.failure
      end

      begin
        result.value!.each { |delta| on_delta.call(delta) }
        nil
      rescue Ai::ProviderError => e
        Rails.logger.warn("[ai] stream transport failure: #{e.message[0, 200]}")
        ApplicationErrors::Failure.new(code: :INTERNAL, context: { message: e.message })
      end
    end

    def stream_companion(user, payload)
      material = user.materials.find_by(id: payload["material_id"])
      return terminal(code: "NOT_FOUND") unless material

      escalated = payload["escalated"] == true
      language = payload["language"]
      sse("rung", {
        "intent" => "explain",
        "rung" => escalated ? "answer" : "hint",
        "canEscalate" => !escalated,
        "language" => language
      })

      position = { "locator" => payload["locator"] || {}, "text" => payload["text"].to_s }
      context = Ai::ContextAssembler.companion_grounding(material, position, selection: payload["selection"].to_s)
      messages = Ai::Prompts.companion(
        question: payload["question"].to_s,
        position_text: position["text"],
        language: language,
        escalated: escalated,
        context: context
      )
      failure = catch(:client_gone) do
        stream_to_tokens(user, messages, ->(delta) { sse("token", { "text" => delta }) })
      end
      return if failure == :client_gone
      return terminal(code: failure.code) if failure.is_a?(ApplicationErrors::Failure)

      write_safely { sse("citation", { "locator" => citation_locator(material, position["locator"]), "quote" => nil }) }
      terminal(code: "OK")
    end

    # The plan-scope companion redeem branch (FR-46, epic P2-12 T3): the
    # SAME prompt/system posture and event vocabulary as the material
    # companion, grounded on the whole plan (ContextAssembler.plan_grounding
    # — mistake-first when the ticket carried an entry). The rung is always
    # hint/answer-less: the plan_companion payload has no escalation flag
    # (delta decision 6), so canEscalate is honestly false. The citation
    # rides the mistake entry's OWN source locator (AD-5: citations are
    # derived server-side, never guessed); with no mistake entry there is no
    # single grounded locator, so no citation event rides.
    # epic-34 T2 (AI 讲解): when the ticket carried node_id, the grounding
    # switches to the node assembly (ContextAssembler.node_grounding — the
    # single node + its confirmed mapped sections) and the prompt gains the
    # teaching directive with the assembler's unmapped honesty flag. The
    # node wins the grounding (the teaching turn is about the node); the
    # mistake citation still rides when an entry came along — the two inputs
    # are orthogonal, and the citation is about the entry, not the ground.
    def stream_plan_companion(user, payload)
      plan = user.study_plans.find_by(id: payload["plan_id"])
      return terminal(code: "NOT_FOUND") unless plan

      mistake_entry = nil
      if payload["mistake_entry_id"]
        mistake_entry = user.mistake_entries.find_by(id: payload["mistake_entry_id"])
        return terminal(code: "NOT_FOUND") unless mistake_entry
      end

      node = nil
      if payload["node_id"]
        node = user.knowledge_nodes.find_by(id: payload["node_id"], plan_id: plan.id)
        return terminal(code: "NOT_FOUND") unless node
      end

      language = payload["language"]
      sse("rung", {
        "intent" => "explain",
        "rung" => "hint",
        "canEscalate" => false,
        "language" => language
      })

      if node
        grounding = Ai::ContextAssembler.node_grounding(plan, node)
        teach_node = Ai::ContextAssembler::TeachingNode.new(title: node.title, unmapped: grounding.unmapped)
        context = grounding
      else
        context = Ai::ContextAssembler.plan_grounding(plan, mistake_entry: mistake_entry)
        teach_node = nil
      end
      messages = Ai::Prompts.plan_companion(
        question: payload["question"].to_s,
        language: language,
        context: context,
        teach_node: teach_node
      )
      failure = catch(:client_gone) do
        stream_to_tokens(user, messages, ->(delta) { sse("token", { "text" => delta }) })
      end
      return if failure == :client_gone
      return terminal(code: failure.code) if failure.is_a?(ApplicationErrors::Failure)

      if mistake_entry
        write_safely { sse("citation", { "locator" => mistake_entry.source_location, "quote" => nil }) }
      end
      terminal(code: "OK")
    end

    # The generated-lesson stream (epic-36 T1, spec decisions 5+6+9 — the
    # reader's live section fill): outline_ready first (the current outline,
    # generated in-stream when the row carries none), then every PENDING
    # chapter as section_start → token* → section_ready, then terminal.
    # Ownership is the row lookup itself (user-scoped find — a foreign or
    # vanished lesson answers NOT_FOUND). Resume semantics: ready sections
    # SKIP (重开=只补欠账); each completed section persists ATOMICALLY with
    # its outline status flip (one row update — 断线不留半句: a drop leaves
    # no half section, and the partial call's cost was already paid, AD-16);
    # CAP_REACHED pauses with everything generated preserved (pausedKind=cap)
    # and provider failures pause with pausedKind=provider, both carrying the
    # code on terminal; there is NO auto-resume — continuing is an explicit
    # new ticket, whose mint clears the pause banner server-side.
    def stream_lesson(user, payload)
      lesson = user.materials.find_by(id: payload["lesson_id"])
      return terminal(code: "NOT_FOUND") unless lesson && lesson.generated? && lesson.generation.is_a?(Hash)

      language = payload["language"]
      generation = lesson.generation
      outline = generation["outline"].is_a?(Array) ? generation["outline"] : []

      if outline.empty?
        outcome = generate_lesson_outline(user, lesson, language)
        return outcome[1] if outcome[0] == :fail

        outline = outcome[1]
      elsif generation["pausedKind"]
        # The explicit resume attempt clears the pause (the reader's banner
        # reads this jsonb — a new ticket is the only way back).
        lesson.update!(generation: generation.merge("pausedKind" => nil))
      end

      sse("outline_ready", { "outline" => outline })

      failure_code = catch(:client_gone) do
        outcome = nil
        outline.each_with_index do |chapter, index|
          next if chapter["status"] == "ready"

          outcome = stream_lesson_section(user, lesson, outline, index, chapter, language)
          break unless outcome.nil?
        end
        outcome
      end
      return if failure_code == :client_gone
      return terminal(code: failure_code) if failure_code

      terminal(code: "OK")
    end

    # ONE chapter's single-pass fill: stream the section prompt's tokens as
    # they arrive (token events + accumulation), then persist ATOMICALLY —
    # the sections array append and the outline status flip in ONE row
    # update, so the reader never sees a half section. Failures pause the
    # lesson (pausedKind) and surface as the terminal code.
    def stream_lesson_section(user, lesson, outline, index, chapter, language)
      sse("section_start", { "sectionId" => chapter["id"], "title" => chapter["title"] })

      context = lesson_section_context(user, chapter)
      messages = Ai::Prompts.lesson_section(language: language, context: context,
                                            lesson_title: lesson.title, chapter_title: chapter["title"])
      result = Ai::Provider.stream(user: user, messages: messages)
      return pause_and_code(lesson, result.failure) if result.failure?

      text = +""
      begin
        result.value!.each do |delta|
          text << delta
          sse("token", { "text" => delta })
        end
      rescue Ai::ProviderError => e
        Rails.logger.warn("[ai] lesson stream transport failure: #{e.message[0, 200]}")
        return pause_and_code(lesson, ApplicationErrors::Failure.new(code: :INTERNAL, context: { message: e.message }))
      end

      body = text.strip
      if body.empty?
        return pause_and_code(lesson, ApplicationErrors::Failure.new(
          code: :INTERNAL, context: { message: "ai lesson section reply was empty" }
        ))
      end

      generation = lesson.generation.dup
      new_outline = generation["outline"].dup
      new_outline[index] = new_outline[index].merge("status" => "ready")
      lesson.update!(
        sections: Array(lesson.sections) + [
          { "id" => chapter["id"], "title" => chapter["title"], "text" => body, "anchors" => chapter["anchors"] }
        ],
        generation: generation.merge("outline" => new_outline)
      )
      sse("section_ready", { "sectionId" => chapter["id"] })
      nil
    end

    # The chapter's grounding: ONLY its assigned anchor sections, resolved
    # against the owner's materials (deleted sources drop honestly — the
    # prompt's honesty clause keeps the model from inventing over a gap).
    def lesson_section_context(user, chapter)
      pairs = Array(chapter["anchors"]).filter_map do |anchor|
        material = user.materials.find_by(id: anchor["materialId"])
        section = material && Ai::ContextAssembler.section_by_id(material, anchor["sectionId"])
        next unless material && section

        [ material, section ]
      end
      Ai::ContextAssembler.lesson_section_grounding(pairs)
    end

    # 无 outline 先出 (spec decision 6): the in-stream outline generation for
    # a lesson row without placeholders. ONE cap-counted call, grounded per
    # variant (node → the node grounding; material → the source's own
    # sections), normalized through the SAME functions the create paths use,
    # placeholders persisted before the first section streams. Returns
    # [:ok, outline] or [:fail, terminal_code] (the failure paths pause the
    # lesson first).
    def generate_lesson_outline(user, lesson, language)
      generation = lesson.generation
      messages =
        if generation["variant"] == Ai::Lessons::VARIANT_NODE
          node = user.knowledge_nodes.find_by(id: lesson.node_id)
          return [ :fail, "NOT_FOUND" ] unless node

          grounding = Ai::ContextAssembler.node_grounding(node.plan, node)
          return [ :fail, "NOT_FOUND" ] if grounding.unmapped

          Ai::Prompts.lesson_outline(language: language, context: grounding, material_title: lesson.title,
                                     outline_target: Ai::Lessons::NODE_SECTION_MAX)
        else
          source = user.materials.find_by(id: Array(generation["sourceMaterialIds"]).first)
          return [ :fail, "NOT_FOUND" ] unless source

          Ai::Prompts.lesson_outline(language: language, context: Ai::ContextAssembler.material_scope(source),
                                     material_title: source.title)
        end

      result = Ai::Provider.complete(user: user, messages: messages)
      return [ :fail, pause_and_code(lesson, result.failure) ] if result.failure?

      chapters =
        if generation["variant"] == Ai::Lessons::VARIANT_NODE
          node = user.knowledge_nodes.find_by(id: lesson.node_id)
          Ai::Lessons.normalize_node_outline(result.value!, node)
        else
          source = user.materials.find_by(id: Array(generation["sourceMaterialIds"]).first)
          Ai::Lessons.normalize_material_outline(result.value!, source)
        end
      if chapters.empty?
        code = pause_and_code(lesson, ApplicationErrors::Failure.new(
          code: :INTERNAL, context: { message: "ai lesson outline payload had no usable chapters" }
        ))
        return [ :fail, code ]
      end

      outline = Ai::Lessons.outline_placeholder(chapters.map { |chapter| { title: chapter[:title] || chapter["title"], anchors: chapter[:anchors] || chapter["anchors"] } })
      lesson.update!(generation: generation.merge("outline" => outline))
      [ :ok, outline ]
    end

    # The pause write (spec decision 9): CAP_REACHED → pausedKind=cap,
    # anything else → pausedKind=provider. Everything already generated
    # stays on the row (the pause never costs work).
    def pause_and_code(lesson, failure)
      kind = failure.code == :CAP_REACHED ? "cap" : "provider"
      lesson.update!(generation: lesson.generation.merge("pausedKind" => kind))
      failure.code.to_s
    end

    def stream_proposal(user, payload)
      language = payload["language"]
      sse("rung", {
        "intent" => "reference",
        "rung" => "hint",
        "canEscalate" => false,
        "language" => language
      })

      splitter = Ai::TaggedReplySplitter.new
      messages = Ai::Prompts.proposal(message: payload["message"].to_s, materials: payload["materials"] || [], language: language)
      failure = catch(:client_gone) do
        stream_to_tokens(user, messages, ->(delta) {
          splitter.feed(delta).each { |token| sse("token", { "text" => token }) }
        })
      end
      return if failure == :client_gone
      return terminal(code: failure.code) if failure.is_a?(ApplicationErrors::Failure)

      proposal = splitter.finish[:proposal]
      unless proposal
        # The tag contract violation is silent on the wire (terminal enum
        # only) — log the tail so a live failure is diagnosable (2026-11-10).
        Rails.logger.warn("[ai] proposal reply failed the tag contract — tail: #{splitter.reply_tail.inspect}")
        return terminal(code: "INTERNAL")
      end

      normalized = normalize_proposal(proposal)
      if normalized["stages"].empty?
        Rails.logger.warn("[ai] proposal reply normalized to zero stages — proposal: #{proposal.inspect[0, 300]}")
        return terminal(code: "INTERNAL")
      end

      terminal(code: "OK", proposal: normalized.merge("language" => language))
    end

    # The proposal JSON's roadmap shape (epic-16 T1): stages carry full nodes
    # ({title, description, optional}) and top-level title-paired edges. The
    # normalization keeps the model honest — titles/descriptions strip
    # (blank descriptions land null), optional coerces to a strict boolean,
    # and edges keep only well-formed non-blank string pairs. Confirm-time
    # resolution and validity drops are downstream's job (the client's
    # flatten seam / Plans::PlanCreation).
    #
    # The legacy pre-epic-16 shape (review F2) stays accepted here, matching
    # ConfirmProposalCommand: a stage carrying bare `nodeTitles` (no `nodes`)
    # maps deterministically to one metadata-less node per title, and the
    # reply's absent top-level edges land empty — the designed degradation to
    # an edgeless plan (the client's legacy fallback path renders it), never
    # a terminal INTERNAL.
    def normalize_proposal(proposal)
      legacy_shape = false
      normalized = {
        "topic" => proposal["topic"].to_s,
        "stages" => Array(proposal["stages"]).filter_map do |stage|
          next unless stage.is_a?(Hash)
          name = stage["name"].to_s.strip
          nodes = Array(stage["nodes"]).filter_map do |node|
            next unless node.is_a?(Hash)
            title = node["title"].to_s.strip
            next if title.empty?

            {
              "title" => title,
              "description" => node["description"].to_s.strip.presence,
              "optional" => node["optional"] == true
            }
          end
          if nodes.empty? && Array(stage["nodeTitles"]).any?
            legacy_shape = true
            nodes = Array(stage["nodeTitles"]).filter_map do |title|
              title = title.to_s.strip
              next if title.empty?

              { "title" => title, "description" => nil, "optional" => false }
            end
          end
          next if name.empty? || nodes.empty?

          { "name" => name, "nodes" => nodes }
        end,
        "edges" => Array(proposal["edges"]).filter_map do |edge|
          next unless edge.is_a?(Array) && edge.length == 2
          from, to = edge
          from = from.to_s.strip
          to = to.to_s.strip
          next if from.empty? || to.empty?

          [ from, to ]
        end
      }
      if legacy_shape
        Rails.logger.info(
          "[plans] legacy proposal shape (nodeTitles) normalized without edges/descriptions — " \
          "one title-only node per title; the edgeless plan renders via the legacy fallback path"
        )
      end
      normalized
    end

    # The citation locator for the grounded position — built server-side
    # from the locator the ticket carried (markdown → sectionId; pdf →
    # page), the gradeOpenAnswer construction mirrored.
    def citation_locator(material, locator)
      if locator["kind"] == "pdf" && locator["page"]
        { "kind" => "pdf", "page" => locator["page"] }
      else
        { "kind" => "markdown", "sectionId" => locator["sectionId"].to_s }
      end
    end
  end
end
