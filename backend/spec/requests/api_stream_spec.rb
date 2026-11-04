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
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
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

  def mint_companion(escalated: false, language: "zh")
    result = ::Ai::CreateStreamTicketCommand.call(
      current_user: user, op: "companion", language: language,
      material_id: material.id, question: "这个部分讲了什么？",
      position: { locator: { kind: "markdown", section_id: "sec-1" }, text: "current view" },
      escalated: escalated
    )
    result.value![:ticket]
  end

  def mint_proposal(language: "zh")
    result = ::Ai::CreateStreamTicketCommand.call(
      current_user: user, op: "proposal", language: language,
      topic: "软件工程", goal: ""
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
  end

  describe "the proposal stream" do
    it "streams only the outline tokens and carries the parsed proposal on the terminal" do
      json = { topic: "软件工程", stages: [
        { name: "阶段一：基础", nodeTitles: [ "命令层", "ER 模型" ] },
        { name: "阶段二：实践", nodeTitles: [ "集成走查" ] }
      ] }.to_json
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
      expect(terminal["data"]["code"]).to eq("OK")
      expect(terminal["data"]["proposal"]).to eq({
        "topic" => "软件工程",
        "language" => "zh",
        "stages" => [
          { "name" => "阶段一：基础", "nodeTitles" => [ "命令层", "ER 模型" ] },
          { "name" => "阶段二：实践", "nodeTitles" => [ "集成走查" ] }
        ]
      })
    end

    it "answers terminal{INTERNAL} on a contract-violating reply" do
      allow(adapter).to receive(:stream).and_return(%w[no tags at all].each)

      stream(mint_proposal)
      expect(events.last["data"]["code"]).to eq("INTERNAL")
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
