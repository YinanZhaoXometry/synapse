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
  #   event: rung      data: {"intent":"explain","rung":"hint|answer","canEscalate":bool,"language":"zh|en"}
  #   event: token     data: {"text":"…"}                      (many, in order)
  #   event: citation  data: {"locator":{...},"quote":null}    (companion only)
  #   event: terminal  data: {"code":"OK"} | {"code":"<enum>"} (+ "proposal":{...} for the proposal op)
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
      return result.failure if result.failure?

      begin
        result.value!.each { |delta| on_delta.call(delta) }
        nil
      rescue Ai::ProviderError => e
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
      context = Ai::ContextAssembler.companion_grounding(material, position)
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
    def stream_plan_companion(user, payload)
      plan = user.study_plans.find_by(id: payload["plan_id"])
      return terminal(code: "NOT_FOUND") unless plan

      mistake_entry = nil
      if payload["mistake_entry_id"]
        mistake_entry = user.mistake_entries.find_by(id: payload["mistake_entry_id"])
        return terminal(code: "NOT_FOUND") unless mistake_entry
      end

      language = payload["language"]
      sse("rung", {
        "intent" => "explain",
        "rung" => "hint",
        "canEscalate" => false,
        "language" => language
      })

      context = Ai::ContextAssembler.plan_grounding(plan, mistake_entry: mistake_entry)
      messages = Ai::Prompts.plan_companion(
        question: payload["question"].to_s,
        language: language,
        context: context
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

    def stream_proposal(user, payload)
      language = payload["language"]
      sse("rung", {
        "intent" => "reference",
        "rung" => "hint",
        "canEscalate" => false,
        "language" => language
      })

      splitter = Ai::TaggedReplySplitter.new
      messages = Ai::Prompts.proposal(topic: payload["topic"].to_s, goal: payload["goal"].to_s, language: language)
      failure = catch(:client_gone) do
        stream_to_tokens(user, messages, ->(delta) {
          splitter.feed(delta).each { |token| sse("token", { "text" => token }) }
        })
      end
      return if failure == :client_gone
      return terminal(code: failure.code) if failure.is_a?(ApplicationErrors::Failure)

      proposal = splitter.finish[:proposal]
      return terminal(code: "INTERNAL") unless proposal

      normalized = {
        "topic" => proposal["topic"].to_s,
        "stages" => Array(proposal["stages"]).filter_map do |stage|
          next unless stage.is_a?(Hash)
          name = stage["name"].to_s.strip
          titles = Array(stage["nodeTitles"]).map { |title| title.to_s.strip }.reject(&:empty?)
          next if name.empty? || titles.empty?

          { "name" => name, "nodeTitles" => titles }
        end
      }
      return terminal(code: "INTERNAL") if normalized["stages"].empty?

      terminal(code: "OK", proposal: normalized.merge("language" => language))
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
