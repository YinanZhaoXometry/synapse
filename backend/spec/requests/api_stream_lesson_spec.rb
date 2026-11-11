# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /api/stream?op=lesson (epic-36 T1 — the generated-lesson section fill)", type: :request do
  # The op contract (spec decisions 5+6+9): outline_ready always first, then
  # every PENDING chapter (section_start → token* → section_ready), then
  # terminal; ready sections SKIP on a re-opened ticket (重开=只补欠账); each
  # completed section persists ATOMICALLY (断线不留半句); CAP_REACHED pauses
  # with pausedKind=cap and provider failures with pausedKind=provider, both
  # carrying the code on terminal; a fresh ticket is the only way back. The
  # 401 matrix is the endpoint's own contract (pinned by api_stream_spec).
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
  let(:source) do
    create(:material, user: user, parse_state: "parsed", title: "Distributed notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication passes writes down a chain" }
    ])
  end

  def default_outline(statuses: %w[pending pending])
    [
      { "id" => "ch-1", "title" => "选举与日志", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ], "status" => statuses[0] },
      { "id" => "ch-2", "title" => "链式复制", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-2" } ], "status" => statuses[1] }
    ]
  end

  def create_lesson(outline: default_outline, sections: [], paused: nil, variant: "material")
    create(:material, user: user, origin: "generated", parse_state: "parsed", kind: "markdown", size_bytes: 0,
                      sections: sections,
                      generation: {
                        "variant" => variant,
                        "sourceMaterialIds" => [ source.id ],
                        "outline" => outline,
                        "pausedKind" => paused,
                        "generatedAt" => Time.current.iso8601
                      })
  end

  def mint(lesson, regenerate: nil)
    result = ::Ai::CreateStreamTicketCommand.call(
      current_user: user, op: "lesson", language: "zh", lesson_id: lesson.id, regenerate: regenerate
    )
    result.value![:ticket]
  end

  def stream(ticket)
    get "/api/stream", params: { ticket: ticket.token, op: ticket.op }
  end

  def events
    response.body.split("\n\n").filter_map do |block|
      event = block[/^event: (.+)$/, 1]
      data = block[/^data: (.+)$/, 1]
      next unless event

      { "event" => event, "data" => JSON.parse(data) }
    end
  end

  let(:adapter) { double("client") }

  before do
    source
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  describe "the ticket payload (mint-time ownership)" do
    it "mints for an owned generated lesson and refuses a foreign, uploaded, or generation-less one" do
      lesson = create_lesson
      expect(mint(lesson)).to be_present

      foreign = create(:user)
      foreign_lesson = create(:material, user: foreign, origin: "generated", generation: { "variant" => "material" })
      expect(
        ::Ai::CreateStreamTicketCommand.call(current_user: user, op: "lesson", language: "zh", lesson_id: foreign_lesson.id)
      ).to be_failure.and have_attributes(failure: have_attributes(code: :NOT_FOUND))

      expect(
        ::Ai::CreateStreamTicketCommand.call(current_user: user, op: "lesson", language: "zh", lesson_id: source.id)
      ).to be_failure.and have_attributes(failure: have_attributes(code: :NOT_FOUND))

      expect(
        ::Ai::CreateStreamTicketCommand.call(current_user: user, op: "lesson", language: "zh", lesson_id: "not-a-uuid")
      ).to be_failure.and have_attributes(failure: have_attributes(code: :NOT_FOUND))
    end
  end

  describe "the first connect (material variant)" do
    it "emits outline_ready → (section_start → tokens → section_ready)×N → terminal OK, persisting each section atomically" do
      lesson = create_lesson
      allow(adapter).to receive(:stream) do |messages|
        if messages.last[:content].include?("链式复制")
          %w[链式 复制].each
        else
          %w[Raft 选举].each
        end
      end

      stream(mint(lesson))
      expect(response).to have_http_status(:ok)

      expect(events.map { |event| event["event"] }).to eq(
        %w[outline_ready] + %w[section_start token token section_ready] + %w[section_start token token section_ready terminal]
      )
      outline_event, first, _a, _b, ready1, second, _c, _d, ready2, terminal = events
      aggregate_failures do
        expect(outline_event["data"]["outline"]).to eq(default_outline)
        expect(first["data"]).to eq({ "sectionId" => "ch-1", "title" => "选举与日志" })
        expect(ready1["data"]).to eq({ "sectionId" => "ch-1" })
        expect(second["data"]).to eq({ "sectionId" => "ch-2", "title" => "链式复制" })
        expect(ready2["data"]).to eq({ "sectionId" => "ch-2" })
        expect(terminal["data"]).to eq({ "code" => "OK" })
      end

      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.sections).to eq([
          { "id" => "ch-1", "title" => "选举与日志", "text" => "Raft选举", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] },
          { "id" => "ch-2", "title" => "链式复制", "text" => "链式复制", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-2" } ] }
        ])
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready ready])
        expect(reloaded.generation["pausedKind"]).to be_nil
      end
    end

    it "grounds each chapter on ONLY its assigned anchor sections" do
      lesson = create_lesson
      prompts = []
      allow(adapter).to receive(:stream) do |messages|
        prompts << messages.map { |message| message[:content] }.join
        %w[正文].each
      end

      stream(mint(lesson))
      aggregate_failures do
        expect(prompts.first).to include("leader election and log replication")
        expect(prompts.first).not_to include("chain replication passes writes down a chain")
        expect(prompts.second).to include("chain replication passes writes down a chain")
        expect(prompts.second).not_to include("leader election and log replication")
        expect(prompts.first).to include("in 简体中文.")
      end
    end

    it "answers terminal{NOT_FOUND} for a vanished or foreign lesson id riding the payload" do
      ticket = create(:stream_ticket, user: user, op: "lesson", payload: { "lesson_id" => "00000000-0000-0000-0000-000000000000", "language" => "zh" })
      allow(adapter).to receive(:stream)

      stream(ticket)
      expect(events.last["data"]).to eq({ "code" => "NOT_FOUND" })
      expect(events.map { |event| event["event"] }).to eq(%w[terminal]) # no outline_ready before the refusal
    end
  end

  describe "the resume semantics (重开=只补欠账)" do
    it "skips ready sections — only the debt streams, one provider call for one pending chapter" do
      lesson = create_lesson(
        outline: default_outline(statuses: %w[ready pending]),
        sections: [ { "id" => "ch-1", "title" => "选举与日志", "text" => "已完成", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] } ]
      )
      calls = 0
      allow(adapter).to receive(:stream) do |messages|
        calls += 1
        expect(messages.last[:content]).to include("链式复制")
        %w[续 传].each
      end

      stream(mint(lesson))
      aggregate_failures do
        expect(events.map { |event| event["event"] }).to eq(%w[outline_ready section_start token token section_ready terminal])
        expect(events.first["data"]["outline"].first["status"]).to eq("ready")
        expect(calls).to eq(1)
        expect(events.last["data"]).to eq({ "code" => "OK" })
      end
      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1 ch-2]) # the ready section untouched
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready ready])
      end
    end

    it "clears the pause banner when the explicit resume completes the remaining sections" do
      lesson = create_lesson(
        outline: default_outline(statuses: %w[ready pending]),
        sections: [ { "id" => "ch-1", "title" => "选举与日志", "text" => "已完成", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] } ],
        paused: "provider"
      )
      allow(adapter).to receive(:stream).and_return(%w[续].each)

      stream(mint(lesson))
      aggregate_failures do
        expect(events.last["data"]).to eq({ "code" => "OK" })
        expect(lesson.reload.generation["pausedKind"]).to be_nil
      end
    end
  end

  describe "the pause semantics (spec decision 9)" do
    it "pauses with pausedKind=cap mid-lesson: everything generated is preserved, terminal carries CAP_REACHED" do
      lesson = create_lesson
      ENV["AI_DAILY_CALL_CAP"] = "1" # the first section's call lands; the second trips
      allow(adapter).to receive(:stream).and_return(%w[Raft 选举].each)

      stream(mint(lesson))
      aggregate_failures do
        expect(events.last["data"]).to eq({ "code" => "CAP_REACHED" })
        # section_start precedes the provider call (the reader's spinner
        # signal) — a refused chapter announces, then the terminal lands.
        expect(events.map { |event| event["event"] }).to eq(%w[outline_ready] + %w[section_start token token section_ready] + %w[section_start terminal])
      end
      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1]) # ch-1 preserved
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready pending])
        expect(reloaded.generation["pausedKind"]).to eq("cap")
      end
    end

    it "pauses with pausedKind=provider on a mid-section transport failure — no half section ever lands" do
      lesson = create_lesson
      allow(adapter).to receive(:stream) do |messages|
        next %w[已完成].each unless messages.last[:content].include?("链式复制")

        deltas = %w[半个].each
        def deltas.each
          yield "半个"
          raise Ai::ProviderError, "provider stream error payload: overloaded"
        end
        deltas
      end

      stream(mint(lesson))
      aggregate_failures do
        expect(events.last["data"]).to eq({ "code" => "INTERNAL" })
        token_text = events.filter_map { |event| event["event"] == "token" && event["data"]["text"] }.join
        expect(token_text).to include("半个") # the partial tokens streamed
      end
      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1]) # ch-2's half NEVER persisted
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready pending])
        expect(reloaded.generation["pausedKind"]).to eq("provider")
      end
    end
  end

  describe "the in-stream outline generation (无 outline 先出)" do
    it "generates the outline in-stream for a lesson row without placeholders, then fills its sections" do
      lesson = create_lesson(outline: [])
      outline_reply = { chapters: [
        { title: "选举", sourceSectionIds: [ "sec-1" ] },
        { title: "凭空", sourceSectionIds: [ "ghost" ] }
      ] }.to_json
      outline_calls = 0
      allow(adapter).to receive(:complete) do |messages|
        outline_calls += 1
        expect(messages.last[:content]).to include("Distributed notes")
        outline_reply
      end
      allow(adapter).to receive(:stream).and_return(%w[正文].each)

      stream(mint(lesson))
      aggregate_failures do
        expect(outline_calls).to eq(1)
        outline_event = events.first
        expect(outline_event["event"]).to eq("outline_ready")
        expect(outline_event["data"]["outline"].map { |chapter| chapter["title"] }).to eq([ "选举" ]) # the ghost chapter dropped
        expect(events.last["data"]).to eq({ "code" => "OK" })
      end
      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.generation["outline"].map { |chapter| chapter["id"] }).to eq(%w[ch-1])
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready])
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1])
      end
    end
  end

  # epic-36 T2 (spec story 5 + the ticket's 重新生成 box): the reader's
  # explicit in-place replace — the ticket payload's regenerate flag makes
  # the op reset the SAME row (sections cleared, outline emptied) before
  # the normal flow re-derives the outline from the CURRENT grounding and
  # re-fills every section. No new row is ever created (the singleton holds).
  describe "the regenerate semantics (重新生成)" do
    it "replaces the lesson in place: sections cleared, outline re-derived, every section re-filled — same row id" do
      lesson = create_lesson(
        outline: default_outline,
        sections: [ { "id" => "ch-1", "title" => "选举与日志", "text" => "旧正文", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] } ]
      )
      outline_reply = { chapters: [
        { title: "新章一", sourceSectionIds: [ "sec-1" ] },
        { title: "新章二", sourceSectionIds: [ "sec-2" ] }
      ] }.to_json
      outline_calls = 0
      allow(adapter).to receive(:complete) do |messages|
        outline_calls += 1
        outline_reply
      end
      allow(adapter).to receive(:stream).and_return(%w[新正文].each)

      stream(mint(lesson, regenerate: true))
      aggregate_failures do
        expect(outline_calls).to eq(1) # the outline call re-burns (重烧额度)
        expect(events.first["event"]).to eq("outline_ready")
        expect(events.first["data"]["outline"].map { |chapter| chapter["title"] }).to eq(%w[新章一 新章二])
        expect(events.map { |event| event["event"] }).to eq(
          %w[outline_ready] + %w[section_start token section_ready] + %w[section_start token section_ready] + %w[terminal]
        )
        expect(events.last["data"]).to eq({ "code" => "OK" })
      end
      reloaded = lesson.reload
      aggregate_failures do
        expect(reloaded.id).to eq(lesson.id) # in place — never a second row
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1 ch-2]) # the old section GONE
        expect(reloaded.sections.map { |section| section["text"] }).to eq(%w[新正文 新正文])
        expect(reloaded.generation["outline"].map { |chapter| chapter["title"] }).to eq(%w[新章一 新章二])
        expect(reloaded.generation["outline"].map { |chapter| chapter["status"] }).to eq(%w[ready ready])
        expect(reloaded.generation["pausedKind"]).to be_nil
      end
    end

    it "clears a cap pause and re-fills everything (the explicit replace is its own way back)" do
      lesson = create_lesson(
        outline: default_outline(statuses: %w[ready pending]),
        sections: [ { "id" => "ch-1", "title" => "选举与日志", "text" => "旧正文", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] } ],
        paused: "cap"
      )
      outline_reply = { chapters: [ { title: "新章", sourceSectionIds: [ "sec-1" ] } ] }.to_json
      allow(adapter).to receive(:complete).and_return(outline_reply)
      allow(adapter).to receive(:stream).and_return(%w[新正文].each)

      stream(mint(lesson, regenerate: true))
      reloaded = lesson.reload
      aggregate_failures do
        expect(events.last["data"]).to eq({ "code" => "OK" })
        expect(reloaded.sections.map { |section| section["id"] }).to eq(%w[ch-1]) # the reset outline re-mints ch-1
        expect(reloaded.sections.first["text"]).to eq("新正文") # the old prose replaced
        expect(reloaded.generation["outline"].map { |chapter| chapter["title"] }).to eq(%w[新章])
        expect(reloaded.generation["pausedKind"]).to be_nil
      end
    end

    it "rides the payload ONLY when true — the frozen shape stays byte-identical otherwise" do
      lesson = create_lesson
      payload_without = mint(lesson).payload
      payload_false = mint(lesson, regenerate: false).payload
      payload_true = mint(lesson, regenerate: true).payload

      aggregate_failures do
        expect(payload_without).to eq({ "lesson_id" => lesson.id, "language" => "zh" })
        expect(payload_false).to eq({ "lesson_id" => lesson.id, "language" => "zh" })
        expect(payload_true).to eq({ "lesson_id" => lesson.id, "language" => "zh", "regenerate" => true })
      end
    end
  end
end
