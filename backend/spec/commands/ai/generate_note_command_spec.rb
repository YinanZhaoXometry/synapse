# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateNoteCommand (FR-40, epic P2-12 T1; delta decisions 1+4+5) against
# a stubbed adapter — the note contract: scope correctness (plan/node/material
# assemblies each ground on the right materials), replay-on-clientUuid (a
# same-user replay returns the existing note WITHOUT a provider call; a
# foreign uuid is VALIDATION_FAILED), one cap-counted provider call, the
# model's enrichment markers kept verbatim in the body AND extracted into the
# enrichment array, and the user-requested annotation placed at the end (or
# after the anchor paragraph when the enrichAt text matches one).
RSpec.describe Ai::GenerateNoteCommand do
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
  let(:plan) { create(:study_plan, user: user, topic: "Distributed systems") }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Consensus", order: 0) }
  let(:plan_material) do
    create(:material, user: user, plan: plan, title: "Plan-wide notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" }
    ])
  end
  let(:node_material) do
    create(:material, user: user, plan: plan, node: node, attachment_scope: "node",
                      title: "Node-pinned notes", sections: [
                        { "id" => "sec-pinned", "title" => "Pinned", "text" => "only the node sees this" }
                      ])
  end
  let(:adapter) { double("client") }
  let(:completions) { [] } # every complete(messages) call's joined prompt text, in order

  before do
    node
    plan_material
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      reply
    end
  end

  # The provider's reply — a standalone markdown note with two AI-placed
  # markers (the prompt's [[enrich|kind|suggestion]] contract) and an H1
  # title line.
  let(:reply) do
    <<~MD
      # Distributed systems in one note

      Raft elects a leader and replicates the log.

      [[enrich|diagram|Raft leader election across three nodes]]

      Chain replication passes writes down a chain.

      [[enrich|chart|failure detection latency comparison]]
    MD
  end

  def call(scope: "plan", plan_id: plan.id, node_id: nil, material_id: nil, enrich_at: nil,
           language: "zh", client_uuid: SecureRandom.uuid, targeting: nil)
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      scope: scope,
      language: language,
      plan_id: plan_id,
      node_id: node_id,
      material_id: material_id,
      enrich_at: enrich_at,
      targeting: targeting
    )
  end

  describe "scope correctness (fixture grounding)" do
    it "plan, node, and material scopes each ground on their own material pool (FR-44)" do
      node_material

      call(scope: "plan", plan_id: plan.id)
      expect(completions.sole).to include("leader election and log replication")
      expect(completions.sole).not_to include("only the node sees this")

      call(scope: "node", node_id: node.id, plan_id: nil)
      expect(completions.second).to include("leader election and log replication")
      expect(completions.second).to include("only the node sees this")

      call(scope: "material", material_id: plan_material.id, plan_id: nil)
      expect(completions.third).to include("leader election and log replication")
    end

    it "carries the reply-language policy into the prompt (AD-16 — one parameter, one policy)" do
      call(language: "en")
      expect(completions.sole).to include("English")

      call(language: "zh", client_uuid: SecureRandom.uuid)
      expect(completions.second).to include("简体中文")
    end
  end

  describe "persistence + the cap" do
    it "persists one user-scoped note with the client uuid as its id, consuming one cap call" do
      uuid = SecureRandom.uuid

      result = call(client_uuid: uuid)
      expect(result).to be_success
      note = result.value![:note]
      expect(note.id).to eq(uuid)
      expect(note.user_id).to eq(user.id)
      expect(note.scope).to eq("plan")
      expect(note.plan_id).to eq(plan.id)
      expect(note.node_id).to be_nil
      expect(note.material_id).to be_nil
      expect(note.title).to eq("Distributed systems in one note")
      expect(note.targeting).to eq([])
      expect(user.ai_usage_counters.sole.call_count).to eq(1)
    end

    it "derives the title from the note's H1, falling back to the scope record's own name" do
      note = call.value![:note]
      expect(note.title).to eq("Distributed systems in one note")

      no_h1 = reply.lines.reject { |line| line.start_with?("# ") }.join
      allow(adapter).to receive(:complete).and_return(no_h1)
      fallback = call(client_uuid: SecureRandom.uuid).value![:note]
      expect(fallback.title).to eq(plan.topic)
    end

    it "keeps the enrichment markers verbatim in the body and extracts them into the array" do
      note = call.value![:note]
      expect(note.body).to include("[[enrich|diagram|Raft leader election across three nodes]]")
      expect(note.enrichment).to eq([
        { "kind" => "diagram", "suggestion" => "Raft leader election across three nodes" },
        { "kind" => "chart", "suggestion" => "failure detection latency comparison" }
      ])
    end

    it "fails INTERNAL when the provider returns no usable body" do
      allow(adapter).to receive(:complete).and_return("   \n  ")
      expect(call.failure.code).to eq(:INTERNAL)
    end
  end

  describe "replay on clientUuid" do
    it "returns the existing note for a same-user replay WITHOUT a provider call" do
      uuid = SecureRandom.uuid
      first = call(client_uuid: uuid)
      expect(first).to be_success

      completions.clear
      replay = call(client_uuid: uuid)
      expect(replay).to be_success
      expect(replay.value![:note].id).to eq(first.value![:note].id)
      expect(completions).to be_empty
      expect(user.ai_usage_counters.sole.call_count).to eq(1) # the replay never spends
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user's note" do
      foreign_note = create(:note, :material_scoped, user: create(:user))

      result = call(scope: "material", material_id: plan_material.id, plan_id: nil, client_uuid: foreign_note.id)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end
  end

  describe "validation matrix (nothing spent)" do
    it "refuses invalid language, malformed uuid shape, and an invalid scope value" do
      expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
      expect(call(client_uuid: "not-a-uuid").failure.code).to eq(:VALIDATION_FAILED)
      expect(call(scope: "stage").failure.code).to eq(:VALIDATION_FAILED)
      expect(completions).to be_empty
    end

    it "refuses zero scope ids and several scope ids" do
      expect(call(plan_id: nil).failure.code).to eq(:VALIDATION_FAILED)
      expect(call(scope: "plan", plan_id: plan.id, material_id: plan_material.id).failure.code)
        .to eq(:VALIDATION_FAILED)
    end

    it "refuses a scope/id mismatch (the id must match the scope value)" do
      expect(call(scope: "node", plan_id: nil, material_id: plan_material.id).failure.code).to eq(:VALIDATION_FAILED)
    end

    it "answers NOT_FOUND uniformly for malformed, unknown, and foreign ids" do
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)
      foreign_node = create(:knowledge_node, user: other)
      foreign_material = create(:material, user: other)

      expect(call(plan_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(plan_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "node", plan_id: nil, node_id: foreign_node.id).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
      expect(call(scope: "material", plan_id: nil, material_id: foreign_material.id).failure.code).to eq(:NOT_FOUND)
      expect(completions).to be_empty
    end

    it "refuses a task node under the node scope (a note's node scope needs a plan node)" do
      task = create(:study_task, user: user)
      expect(call(scope: "node", plan_id: nil, node_id: task.node_id).failure.code).to eq(:VALIDATION_FAILED)
    end
  end

  describe "the user-requested annotation (enrichAt)" do
    it "appends the [[enrich|user|…]] marker at the END of the body by default" do
      note = call(enrich_at: "a timeline of the consensus rounds").value![:note]
      expect(note.body.strip).to end_with("[[enrich|user|a timeline of the consensus rounds]]")
      expect(note.enrichment.last).to eq({ "kind" => "user", "suggestion" => "a timeline of the consensus rounds" })
    end

    it "places the marker right after the paragraph containing the enrichAt substring when one matches" do
      note = call(enrich_at: "Raft elects a leader").value![:note]
      blocks = note.body.split("\n\n")
      anchor_index = blocks.index { |block| block.include?("Raft elects a leader") }
      expect(blocks[anchor_index + 1]).to eq("[[enrich|user|Raft elects a leader]]")
    end

    it "falls back to the end of the body when the anchor matches no paragraph" do
      note = call(enrich_at: "not in the note at all").value![:note]
      expect(note.body.strip).to end_with("[[enrich|user|not in the note at all]]")
    end

    it "adds no user marker when enrichAt is absent or blank" do
      plain = call.value![:note]
      expect(plain.enrichment.map { |marker| marker["kind"] }).to eq(%w[diagram chart])

      blank = call(enrich_at: "   ", client_uuid: SecureRandom.uuid).value![:note]
      expect(blank.body).to eq(plain.body)
    end
  end

  # -- weak-spot targeting (FR-22, epic P2-12 T2) ----------------------------------

  describe "weak-spot targeting (FR-22, epic P2-12 T2)" do
    let(:weak_node) { create(:knowledge_node, user: user, plan: plan, title: "Weak node", order: 1) }
    let(:mid_node) { create(:knowledge_node, user: user, plan: plan, title: "Half node", order: 2) }
    let(:strong_node) { create(:knowledge_node, user: user, plan: plan, title: "Strong node", order: 3) }

    # The crafted bias inputs, through their ONE sources (AD-6/AD-14): the
    # describe owns its node set — the file's default node is destroyed and
    # three crafted candidates ride in: weak_node scores 0 (three wrongs) and
    # carries a mistake entry (weight 4.0 = cap); mid_node scores 50 (weight
    # 2.0); strong_node scores 100 (weight 1.0). total = the candidate count
    # (3) → the largest-remainder shares EXACTLY weak 2 / mid 1 / strong 0 —
    # the 0/50/100 scores order the shares, the weak node dominates, the
    # mastered node gets nothing.
    before do
      node.destroy
      weak_node
      mid_node
      strong_node
      3.times { create(:evidence_record, user: user, node: weak_node, outcome: "wrong") }
      create(:mistake_entry, user: user,
                             question: create(:question, user: user, node: weak_node, source_material: plan_material),
                             node: weak_node)
      3.times { create(:evidence_record, user: user, node: mid_node, outcome: "partial") }
      3.times { create(:evidence_record, user: user, node: strong_node, outcome: "correct") }
    end

    # Captures the user prompt the command built (the adapter seam's
    # stub-ability contract — the adapter receives the messages positionally)
    # and answers with the given markdown body.
    def generated_prompt(targeting:, payload:, **call_args)
      captures = []
      allow(adapter).to receive(:complete) do |messages|
        captures << messages
        payload
      end
      call(targeting: targeting, **call_args)
      captures.sole.last[:content]
    end

    describe "targeting absent (nil — the byte-for-byte default)" do
      # T2's default-safe promise: targeting ABSENT keeps the T1 prompt shape
      # byte-for-byte — the coverage block's blank branch and the untouched
      # template must never drift. This pin is the FULL-STRING eq a regression
      # cannot slip past (the quiz targeting's pre-T5 pin, mirrored): any
      # reworded line, lost blank line, or coverage-note leak fails here even
      # with every other spec green. The literal is T1's Prompts.note (the
      # landed template at c3eccfd) with this fixture's assembled plan_scope
      # text interpolated where the command interpolates it.
      it "builds the EXACT T1 template for a plan-scope call — full-string eq, no coverage plan" do
        prompt = generated_prompt(targeting: nil, payload: reply)

        expected = <<~PROMPT
          Study material context (the ONLY allowed source):
          ---
          #{Ai::ContextAssembler.plan_scope(plan).text}
          ---


          Write a standalone, exportable Markdown study note from ONLY the material above — a learner must be able to read it without the original material at hand.
          Begin the note with a single level-1 heading ("# …") that names the note; structure it with headings and short paragraphs.
          Aim for 800–1200 words (target: 1000).
          Where a visual would genuinely aid understanding, insert an enrichment marker on its own line, in EXACTLY this form:
          [[enrich|kind|what the visual should show]]
          kind is one of: "diagram", "chart", "image". Placement is your call — only where a picture truly helps; never place a marker for something the material does not ground.
          Write every user-facing string in 简体中文.

          Reply ONLY with the Markdown note itself — no code fences, no commentary before or after.
        PROMPT
        # Two blank lines between the context fence and "Write": the empty
        # notes slot (context untruncated + coverage note absent) is part of
        # the pinned T1 shape.
        aggregate_failures do
          expect(prompt).to eq(expected)
          expect(prompt).not_to include("Weak-spot coverage plan")
        end
      end

      it "keeps the provenance jsonb empty (T1's v1 shape)" do
        expect(call.value![:note].targeting).to eq([])
      end
    end

    describe "targeting present (the weak-spot shape)" do
      it "carries the plan_scope context verbatim and the deterministic coverage plan, weak nodes dominating" do
        prompt = generated_prompt(targeting: { mode: "weakSpot" }, payload: reply)

        aggregate_failures do
          # FR-18/NFR-1 invariant: the assembled context IS the plan-scope
          # output, quoted into the prompt between its markers.
          expect(prompt).to include(Ai::ContextAssembler.plan_scope(plan).text)
          # The quota table: the recorded weights (weak 4.0 = score-0 + mistake
          # bonus, mid 2.0 = score-50, strong 1.0 = score-100) over total =
          # the candidate count (3) → the worked-example allocation.
          expect(prompt).to include("[node id=#{weak_node.id}] Weak node — coverage weight 2 of 3")
          expect(prompt).to include("[node id=#{mid_node.id}] Half node — coverage weight 1 of 3")
          expect(prompt).to include("[node id=#{strong_node.id}] Strong node — coverage weight 0 of 3")
          # FR-22's framing + the NFR-1 constraint line.
          expect(prompt).to include("aimed at what the learner has not yet demonstrated")
          expect(prompt).to include("cover the marked nodes proportionally to their gaps")
          expect(prompt).to include("ONLY the context above")
        end
      end

      it "persists the allocation table as the targeting provenance jsonb and consumes ONE cap call" do
        result = call(targeting: { mode: "weakSpot" })
        expect(result).to be_success
        expect(result.value![:note].targeting).to eq([
          { "nodeId" => weak_node.id, "title" => "Weak node", "score" => "0", "mistakes" => 1, "share" => 2 },
          { "nodeId" => mid_node.id, "title" => "Half node", "score" => "50", "mistakes" => 0, "share" => 1 },
          { "nodeId" => strong_node.id, "title" => "Strong node", "score" => "100", "mistakes" => 0, "share" => 0 }
        ])
        expect(user.ai_usage_counters.sole.call_count).to eq(1) # AD-16 — still one AI surface
      end

      it "replays the same uuid without a provider call and the same provenance rows" do
        uuid = SecureRandom.uuid
        first = call(targeting: { mode: "weakSpot" }, client_uuid: uuid)
        expect(first).to be_success

        completions.clear
        replay = call(targeting: { mode: "weakSpot" }, client_uuid: uuid)
        expect(replay).to be_success
        expect(replay.value![:note].id).to eq(first.value![:note].id)
        expect(replay.value![:note].targeting).to eq(first.value![:note].targeting)
        expect(completions).to be_empty
        expect(user.ai_usage_counters.sole.call_count).to eq(1) # the replay never spends
      end
    end

    describe "targeting validation (nothing is spent)" do
      it "refuses targeting on node and material scopes (the bias needs a node set)" do
        allow(adapter).to receive(:complete)
        aggregate_failures do
          expect(call(scope: "node", plan_id: nil, node_id: node.id,
                      targeting: { mode: "weakSpot" }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(scope: "material", plan_id: nil, material_id: plan_material.id,
                      targeting: { mode: "weakSpot" }).failure.code).to eq(:VALIDATION_FAILED)
        end
        expect(adapter).not_to have_received(:complete)
        expect(user.ai_usage_counters).to be_empty
      end

      it "refuses a present-but-invalid, blank, or missing mode (blank is not absent)" do
        allow(adapter).to receive(:complete)
        aggregate_failures do
          expect(call(targeting: { mode: "banana" }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(targeting: { mode: "" }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(targeting: { mode: "   " }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(targeting: {}).failure.code).to eq(:VALIDATION_FAILED)
        end
        expect(adapter).not_to have_received(:complete)
        expect(user.ai_usage_counters).to be_empty
      end

      it "refuses targeting that is not an object" do
        allow(adapter).to receive(:complete)

        expect(call(targeting: "weakSpot").failure.code).to eq(:VALIDATION_FAILED)
        expect(adapter).not_to have_received(:complete)
      end
    end
  end
end
