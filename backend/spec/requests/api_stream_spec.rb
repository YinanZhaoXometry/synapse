# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /api/stream (epic P2-5 ticket 04 — the ONE non-GraphQL surface)", type: :request do
  # The endpoint contract: 401 on any bad ticket (never retries auth), the
  # frozen event vocabulary (rung → token* → citation → terminal for
  # companion; rung → token* → terminal{proposal} for proposal), and the
  # cap/transport failures arriving as terminal enum codes. Tickets are
  # minted directly through the command; the createStreamTicket mutation's
  # wire shape is pinned in spec/requests/graphql_ai_mutations_spec.rb.
  around do |example|
    keys = %w[AI_API_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["AI_API_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:material) do
    create(:material, user: user, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." },
      { "id" => "sec-2", "title" => "Commands", "text" => "Commands never raise." }
    ])
  end
  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def mint_companion(escalated: false, language: "zh", selection: nil)
    result = ::Ai::CreateStreamTicketCommand.call(
      current_user: user, op: "companion", language: language,
      material_id: material.id, question: "这个部分讲了什么？",
      position: { locator: { kind: "markdown", section_id: "sec-1" }, text: "current view" },
      escalated: escalated,
      selection: selection
    )
    result.value![:ticket]
  end

  def mint_proposal(language: "zh")
    result = ::Ai::CreateStreamTicketCommand.call(
      current_user: user, op: "proposal", language: language,
      message: "软件工程期末备考"
    )
    result.value![:ticket]
  end

  def stream(ticket, op: nil)
    get "/api/stream", params: { ticket: ticket.token, op: op || ticket.op }
  end

  def events
    response.body.split("\n\n").filter_map do |block|
      event = block[/^event: (.+)$/, 1]
      data = block[/^data: (.+)$/, 1]
      next unless event

      { "event" => event, "data" => JSON.parse(data) }
    end
  end

  describe "the 401 matrix (ticket-only auth, never retried)" do
    it "rejects a missing, unknown, expired, replayed, and op-mismatched ticket" do
      allow(adapter).to receive(:stream).and_return([].each) # auth is the subject, not the events
      get "/api/stream", params: { op: "companion" }
      expect(response).to have_http_status(:unauthorized)

      stream(mint_companion, op: "proposal") # op mismatch
      expect(response).to have_http_status(:unauthorized)

      expired = mint_companion
      expired.update!(expires_at: 1.second.ago)
      stream(expired)
      expect(response).to have_http_status(:unauthorized)

      fresh = mint_companion
      stream(fresh)
      expect(response).to have_http_status(:ok)
      stream(fresh) # replay
      expect(response).to have_http_status(:unauthorized)
      expect(StreamTicket.find(fresh.id).consumed_at).to be_present
    end

    it "answers 401 with the code payload, not a rendered string" do
      stream(mint_companion, op: "proposal")
      expect(response.parsed_body).to eq({ "code" => "UNAUTHORIZED" })
    end
  end

  describe "the companion stream" do
    it "emits rung → token* → citation → terminal{OK}, echoing the language" do
      allow(adapter).to receive(:stream).and_return(%w[每个 行 都有 user_id].each)
      ticket = mint_companion(language: "zh")

      stream(ticket)
      expect(response).to have_http_status(:ok)
      expect(response.headers["Content-Type"]).to start_with("text/event-stream")

      expect(events.map { |event| event["event"] }).to eq(%w[rung] + %w[token] * 4 + %w[citation terminal])
      rung, _t1, t2, _t3, _t4, citation, terminal = events
      expect(rung["data"]).to eq({
        "intent" => "explain", "rung" => "hint", "canEscalate" => true, "language" => "zh"
      })
      expect(t2["data"]["text"]).to eq("行")
      expect(citation["data"]["locator"]).to eq({ "kind" => "markdown", "sectionId" => "sec-1" })
      expect(terminal["data"]).to eq({ "code" => "OK" })
    end

    it "derives the answer rung from the escalation flag (the ladder amendment)" do
      allow(adapter).to receive(:stream).and_return(%w[The answer].each)
      stream(mint_companion(escalated: true, language: "en"))

      rung, _t1, _t2, citation, terminal = events
      expect(rung["data"]["rung"]).to eq("answer")
      expect(rung["data"]["canEscalate"]).to be(false)
      expect(rung["data"]["language"]).to eq("en")
      expect(terminal["data"]["code"]).to eq("OK")
    end

    it "carries a provider transport failure as terminal{INTERNAL}" do
      deltas = %w[partial].each
      def deltas.each
        yield "partial"
        raise Ai::ProviderError, "provider stream error payload: overloaded"
      end
      allow(adapter).to receive(:stream).and_return(deltas)

      stream(mint_companion)
      terminal = events.last
      expect(terminal["event"]).to eq("terminal")
      expect(terminal["data"]["code"]).to eq("INTERNAL")
    end

    it "carries CAP_REACHED as a terminal code without any token" do
      create(:ai_usage_counter, user: user, call_count: 50)
      allow(adapter).to receive(:stream)

      stream(mint_companion)
      token_events = events.filter_map { |event| event["event"] == "token" && event }
      expect(token_events).to be_empty
      expect(events.last["data"]["code"]).to eq("CAP_REACHED")
    end

    it "answers terminal{NOT_FOUND} when the material vanished between mint and redeem" do
      ticket = mint_companion
      material.destroy!
      allow(adapter).to receive(:stream)

      stream(ticket)
      expect(events.last["data"]["code"]).to eq("NOT_FOUND")
    end

    # epic-13 T1 (FR-13): the selection bar's Ask grounds the turn on the
    # selected text — the ticket carries it, the assembler prepends the
    # [selection] block, and the prompt the provider receives shows it.
    it "grounds on the ticket's selection — the [selection] block rides the assembled context" do
      captured = nil
      allow(adapter).to receive(:stream) do |messages|
        captured = messages
        %w[selection-grounded].each
      end
      ticket = mint_companion(selection: "Every row is scoped by user_id.")

      stream(ticket)
      expect(response).to have_http_status(:ok)
      expect(events.last["data"]["code"]).to eq("OK")
      expect(captured).to be_present
      expect(captured.last[:content]).to include("[selection]\nEvery row is scoped by user_id.")
      expect(captured.last[:content].index("[selection]")).to be < captured.last[:content].index("[reading position]")
    end
  end

  describe "the proposal stream" do
    it "streams only the outline tokens and carries the parsed roadmap proposal on the terminal" do
      json = { topic: "软件工程", stages: [
        { name: "阶段一：基础", nodes: [
          { title: "命令层", description: "命令层先行", optional: false },
          { title: "ER 模型" }
        ] },
        { name: "阶段二：实践", nodes: [
          { title: "集成走查", optional: true }
        ] }
      ], edges: [ [ "命令层", "集成走查" ], [ "junk" ] ] }.to_json
      reply = "<outline>\n阶段一：基础（命令层、ER 模型）\n阶段二：实践\n</outline>\n<proposal>\n#{json}\n</proposal>"
      # Split mid-tag to prove the wire never sees tag fragments.
      half = reply.length / 2
      allow(adapter).to receive(:stream).and_return([ reply[0...half], reply[half..] ].each)

      stream(mint_proposal(language: "zh"))

      token_text = events.filter_map { |event| event["event"] == "token" && event["data"]["text"] }.join
      terminal = events.last

      expect(token_text).to include("阶段一：基础")
      expect(token_text).not_to include("<outline>")
      expect(token_text).not_to include("nodeTitles")
      expect(token_text).not_to include('"edges"')
      expect(terminal["data"]["code"]).to eq("OK")
      # The epic-16 roadmap shape: stage nodes with metadata + title-paired
      # edges (only well-formed pairs survive the normalization — the
      # confirm-time resolution and drops are downstream's job).
      expect(terminal["data"]["proposal"]).to eq({
        "topic" => "软件工程",
        "language" => "zh",
        "stages" => [
          { "name" => "阶段一：基础", "nodes" => [
            { "title" => "命令层", "description" => "命令层先行", "optional" => false },
            { "title" => "ER 模型", "description" => nil, "optional" => false }
          ] },
          { "name" => "阶段二：实践", "nodes" => [
            { "title" => "集成走查", "description" => nil, "optional" => true }
          ] }
        ],
        "edges" => [ [ "命令层", "集成走查" ] ]
      })
    end

    it "asks the model for the epic-16 roadmap proposal schema (prompt fixture, no live AI)" do
      captured = nil
      allow(adapter).to receive(:stream) do |messages|
        captured = messages
        [].each
      end

      stream(mint_proposal(language: "en"))

      user_prompt = captured.last[:content]
      aggregate_failures do
        # The proposal JSON schema the reply contract pins: stage nodes with
        # metadata + title-paired edges (epic-27: the model derives the short
        # topic from the message — the template says so instead of echoing it).
        expect(user_prompt).to include(
          '{"topic":"A short plan title derived from the message","stages":[{"name":"…","nodes":[{"title":"…","description":"…","optional":false}]}],"edges":[["…","…"]]}'
        )
        expect(user_prompt).to include("The learner's message: 软件工程期末备考")
        # The four constraints the epic pins on the proposal.
        expect(user_prompt).to include("at most 16 nodes total")
        expect(user_prompt).to include("titles are unique")
        expect(user_prompt).to include("strictly BEFORE")
        expect(user_prompt).to include("at least one inbound edge")
        expect(user_prompt).to include("English")
      end
    end

    it "answers terminal{INTERNAL} on a contract-violating reply" do
      allow(adapter).to receive(:stream).and_return(%w[no tags at all].each)

      stream(mint_proposal)
      expect(events.last["data"]["code"]).to eq("INTERNAL")
    end

    it "accepts the legacy nodeTitles reply via the logged normalization — title-only nodes, zero edges" do
      # The pre-epic-16 wire shape: stages carry bare titles and the reply has
      # no top-level edges. The designed degradation — the stream still
      # completes (never terminal{INTERNAL}) with an edgeless, metadata-less
      # proposal that renders via the client's legacy fallback path.
      json = { topic: "软件工程", stages: [
        { name: "阶段一：基础", nodeTitles: [ "命令层", "ER 模型" ] },
        { name: "阶段二：实践", nodeTitles: [ "集成走查" ] }
      ] }.to_json
      reply = "<outline>\n阶段一：基础（命令层、ER 模型）\n</outline>\n<proposal>\n#{json}\n</proposal>"
      allow(adapter).to receive(:stream).and_return([ reply ].each)
      allow(Rails.logger).to receive(:info)

      stream(mint_proposal(language: "zh"))

      terminal = events.last
      expect(terminal["data"]["code"]).to eq("OK")
      expect(terminal["data"]["proposal"]).to eq({
        "topic" => "软件工程",
        "language" => "zh",
        "stages" => [
          { "name" => "阶段一：基础", "nodes" => [
            { "title" => "命令层", "description" => nil, "optional" => false },
            { "title" => "ER 模型", "description" => nil, "optional" => false }
          ] },
          { "name" => "阶段二：实践", "nodes" => [
            { "title" => "集成走查", "description" => nil, "optional" => false }
          ] }
        ],
        "edges" => []
      })
      expect(Rails.logger).to have_received(:info).with(a_string_including("[plans] legacy proposal shape"))
    end
  end

  # epic P2-12 T3 (FR-46): the plan-scope companion stream — the SAME event
  # vocabulary and prompt posture as companion, grounded on the plan (with
  # the optional mistake entry); the citation rides the mistake's own source
  # locator, and no citation exists without one (nothing is fabricated).
  describe "the plan_companion stream" do
    let(:plan) { create(:study_plan, user: user) }

    def mint_plan_companion(mistake_entry: nil, language: "zh", question: "这个计划的重点是什么？")
      result = ::Ai::CreateStreamTicketCommand.call(
        current_user: user, op: "plan_companion", language: language,
        plan_id: plan.id, question: question, mistake_entry_id: mistake_entry&.id
      )
      result.value![:ticket]
    end

    def mistake_entry_for(material, section_id)
      node = create(:knowledge_node, user: user, plan: plan)
      question = create(:question, user: user, node: node, source_material: material,
                                   source_section_id: section_id, prompt: "How is every row scoped?")
      create(:mistake_entry, user: user, question: question, node: node,
                             source_location: { "kind" => "markdown", "sectionId" => section_id })
    end

    it "emits rung(hint, canEscalate false — the payload carries no escalation) → token* → terminal{OK} without a citation" do
      allow(adapter).to receive(:stream).and_return(%w[先 看 节点 层].each)

      stream(mint_plan_companion)
      expect(response).to have_http_status(:ok)

      expect(events.map { |event| event["event"] }).to eq(%w[rung] + %w[token] * 4 + %w[terminal])
      rung, _t1, _t2, _t3, _t4, terminal = events
      expect(rung["data"]).to eq({
        "intent" => "explain", "rung" => "hint", "canEscalate" => false, "language" => "zh"
      })
      expect(terminal["data"]).to eq({ "code" => "OK" })
    end

    it "carries the mistake's own source locator on the citation event (mistake-grounded turn)" do
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
      ])
      entry = mistake_entry_for(material, "sec-1")
      allow(adapter).to receive(:stream).and_return(%w[错因 分析].each)

      stream(mint_plan_companion(mistake_entry: entry))

      expect(events.map { |event| event["event"] }).to eq(%w[rung token token citation terminal])
      citation = events.fourth
      expect(citation["data"]).to eq({
        "locator" => { "kind" => "markdown", "sectionId" => "sec-1" },
        "quote" => nil
      })
      expect(events.last["data"]["code"]).to eq("OK")
    end

    it "grounds the generation on the plan scope + mistake-first context (the adapter sees the assembled messages)" do
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
      ])
      entry = mistake_entry_for(material, "sec-1")
      captured = nil
      # The adapter seam receives the prompt messages positionally
      # (Ai::Provider#dispatch → client.stream(messages)).
      allow(adapter).to receive(:stream) do |messages|
        captured = messages
        %w[回答].each
      end

      stream(mint_plan_companion(mistake_entry: entry, language: "en"))

      messages = captured
      expect(messages.first[:role]).to eq("system")
      user_prompt = messages.second[:content]
      expect(user_prompt).to include("How is every row scoped?")
      expect(user_prompt).to include("[section id=sec-1")
      expect(user_prompt).to include("[node ")
      expect(user_prompt).to include("English")
    end

    it "answers terminal{NOT_FOUND} when the plan vanished between mint and redeem" do
      ticket = mint_plan_companion
      plan.destroy!
      allow(adapter).to receive(:stream)

      stream(ticket)
      expect(events.last["data"]["code"]).to eq("NOT_FOUND")
    end

    it "answers terminal{NOT_FOUND} when the mistake entry vanished between mint and redeem" do
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "Scoping", "text" => "scoped" }
      ])
      entry = mistake_entry_for(material, "sec-1")
      ticket = mint_plan_companion(mistake_entry: entry)
      entry.destroy!
      allow(adapter).to receive(:stream)

      stream(ticket)
      expect(events.last["data"]["code"]).to eq("NOT_FOUND")
    end

    it "carries CAP_REACHED as a terminal code for the plan stream too" do
      create(:ai_usage_counter, user: user, call_count: 50)
      allow(adapter).to receive(:stream)

      stream(mint_plan_companion)
      expect(events.last["data"]["code"]).to eq("CAP_REACHED")
    end
  end

  describe "the route + CORS posture" do
    it "mounts /api/stream as a GET route (401, never 404)" do
      expect { get "/api/stream", params: { ticket: "x", op: "companion" } }.not_to raise_error
      expect(response).to have_http_status(:unauthorized)
    end

    it "leaves cross-origin closed when CORS_ORIGIN is unset (the pre-cutover default)" do
      # The middleware is wired (boot-time), but no origins are allowlisted.
      options "/api/stream", headers: { "Origin" => "https://evil.example", "Access-Control-Request-Method" => "GET" }
      expect(response.headers["Access-Control-Allow-Origin"]).to be_nil
    end
  end
end
