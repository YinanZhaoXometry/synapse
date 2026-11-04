# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateQuizCommand (ticket 03) against a stubbed adapter — no live
# provider calls in CI. The stub targets Ai::Provider.adapter (the seam's
# stub-ability contract, ticket 01), so the cap (ticket 02) stays real: every
# generation consumes exactly one counted call.
RSpec.describe Ai::GenerateQuizCommand do
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
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Scope node") }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." },
      { "id" => "sec-2", "title" => "Commands", "text" => "Commands never raise; failures are typed." }
    ])
  end
  let(:adapter) { double("client") }
  let(:client_uuid) { SecureRandom.uuid }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def call(plan_id: plan.id, task_id: nil, mode: "open", language: "zh", uuid: client_uuid, targeting: nil)
    described_class.call(
      current_user: user, client_uuid: uuid, mode: mode, language: language,
      plan_id: plan_id, task_id: task_id, targeting: targeting
    )
  end

  def question_payload(node_id: node.id, material_id: material.id, section_id: "sec-1", kind: "open", **overrides)
    {
      nodeId: node_id, kind: kind,
      prompt: "How is every row scoped?",
      options: kind == "choice" ? [ "user_id", "email" ] : nil,
      correctOptionIndex: kind == "choice" ? 0 : nil,
      sourceMaterialId: material_id, sourceSectionId: section_id,
      keywords: [ "user_id", "scope" ],
      explanation: "By the user_id foreign key on the row itself (AD-13)."
    }.merge(overrides)
  end

  def fenced(payload)
    "Certainly! Here are your questions:\n```json\n#{payload.to_json}\n```\nGood luck!"
  end

  it "generates and persists through the epic P2-3 command, consuming one cap call" do
    allow(adapter).to receive(:complete).and_return(fenced({ questions: [ question_payload ] }))

    result = call
    expect(result).to be_success
    session = result.value![:session]
    expect(session.mode).to eq("open")
    expect(session.plan_id).to eq(plan.id)
    question = result.value![:questions].sole
    expect(question.node_id).to eq(node.id)
    expect(question.source_material_id).to eq(material.id)
    expect(question.source_section_id).to eq("sec-1")
    expect(question.position).to eq(0)
    expect(user.ai_usage_counters.sole.call_count).to eq(1)
  end

  it "keeps only in-scope, well-shaped questions (the enum-guard), dropping the rest" do
    other_plan = create(:study_plan, user: user)
    foreign_node = create(:knowledge_node, user: user, plan: other_plan)
    payload = {
      questions: [
        question_payload,                                     # usable
        question_payload(kind: "truefalse"),                  # bad kind → dropped
        question_payload(node_id: foreign_node.id),           # out-of-scope node → dropped
        question_payload(section_id: "ghost"),                # unknown section → dropped
        question_payload(material_id: SecureRandom.uuid),     # unknown material → dropped
        question_payload(prompt: "  ")                        # empty prompt → dropped
      ]
    }
    allow(adapter).to receive(:complete).and_return(payload.to_json)

    result = call
    expect(result).to be_success
    expect(result.value![:questions].length).to eq(1)
  end

  it "keeps usable choice questions and drops malformed choice shapes" do
    payload = {
      questions: [
        question_payload(kind: "choice"),
        question_payload(kind: "choice", options: [ "only" ]),
        question_payload(kind: "choice", options: %w[a b], correctOptionIndex: 5),
        question_payload(kind: "choice", options: %w[a b], correctOptionIndex: "0")
      ]
    }
    allow(adapter).to receive(:complete).and_return(payload.to_json)

    result = call(mode: "choice")
    expect(result).to be_success
    kept = result.value![:questions].sole
    expect(kept.kind).to eq("choice")
    expect(kept.options).to eq([ "user_id", "email" ])
    expect(kept.correct_option_index).to eq(0)
  end

  it "fails INTERNAL when the reply carries no JSON" do
    allow(adapter).to receive(:complete).and_return("I cannot answer that.")
    result = call
    expect(result.failure.code).to eq(:INTERNAL)
    expect(result.failure.context[:message]).to include("no usable questions")
  end

  it "fails INTERNAL when no question survives normalization" do
    allow(adapter).to receive(:complete).and_return({ questions: [ { garbage: true } ] }.to_json)
    result = call
    expect(result.failure.code).to eq(:INTERNAL)
  end

  it "validates the language argument" do
    allow(adapter).to receive(:complete)
    result = call(language: "fr")
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
  end

  it "refuses a non-uuid client uuid and a garbage mode before anything is spent" do
    allow(adapter).to receive(:complete)
    expect(call(uuid: "not-a-uuid").failure.code).to eq(:VALIDATION_FAILED)
    expect(call(mode: "truefalse").failure.code).to eq(:VALIDATION_FAILED)
    expect(adapter).not_to have_received(:complete)
    expect(user.ai_usage_counters).to be_empty # the cap was never touched
  end

  it "validates the scope: both, neither, and foreign are refused" do
    allow(adapter).to receive(:complete)
    other_user = create(:user)
    foreign_plan = create(:study_plan, user: other_user)

    expect(call(plan_id: plan.id, task_id: create(:study_task, user: user).id).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(plan_id: nil, task_id: nil).failure.code).to eq(:VALIDATION_FAILED)
    expect(call(plan_id: foreign_plan.id).failure.code).to eq(:NOT_FOUND)
    expect(adapter).not_to have_received(:complete)
  end

  it "replays an owned session WITHOUT a provider call (a retry never spends twice)" do
    allow(adapter).to receive(:complete).and_raise(Ai::ProviderError, "must not be called")
    existing = create(:quiz_session, user: user, id: client_uuid, mode: "choice")

    result = call(mode: "open")
    expect(result).to be_success
    expect(result.value![:session].id).to eq(existing.id)
    expect(result.value![:session].mode).to eq("choice") # the original stands
    expect(result.value![:questions].length).to eq(existing.questions.count)
    expect(user.ai_usage_counters).to be_empty
  end

  it "refuses a foreign client uuid before generating" do
    other_user = create(:user)
    create(:quiz_session, user: other_user, id: client_uuid)
    allow(adapter).to receive(:complete)

    result = call
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(result.failure.context[:message]).to include("another user")
    expect(adapter).not_to have_received(:complete)
  end

  it "passes CAP_REACHED through from the seam" do
    create(:ai_usage_counter, user: user, call_count: 50)
    allow(adapter).to receive(:complete).and_return(fenced({ questions: [ question_payload ] }))

    result = call
    expect(result.failure.code).to eq(:CAP_REACHED)
    expect(adapter).not_to have_received(:complete)
  end

  it "works on a task scope with the task's single node" do
    task_node = create(:knowledge_node, user: user, title: "Task node")
    task_material = create(:material, user: user, sections: [ { "id" => "t-sec", "title" => "T", "text" => "task text" } ])
    task = create(:study_task, user: user, node: task_node, material: task_material)
    allow(adapter).to receive(:complete).and_return(
      fenced({ questions: [ question_payload(node_id: task.node.id, material_id: task.material.id, section_id: "t-sec") ] })
    )

    result = call(plan_id: nil, task_id: task.id, mode: "mix")
    expect(result).to be_success
    expect(result.value![:session].task_id).to eq(task.id)
    expect(result.value![:questions].sole.node_id).to eq(task.node.id)
  end

  # -- targeting (FR-21, epic P2-10 T5) --------------------------------------------

  describe "targeting" do
    let(:weak_node) { create(:knowledge_node, user: user, plan: plan, title: "Weak node", order: 1) }
    let(:strong_node) { create(:knowledge_node, user: user, plan: plan, title: "Strong node", order: 2) }

    # The bias inputs, through their ONE sources (AD-6/AD-14): weak_node
    # scores 0 (three wrongs) and carries a mistake entry (+1.0 bonus →
    # weight 4.0); strong_node scores 100 (weight 1.0). Over the default 5
    # questions the recorded weights allocate EXACTLY 4 / 1.
    before do
      3.times { create(:evidence_record, user: user, node: weak_node, outcome: "wrong") }
      create(:mistake_entry, user: user,
                             question: create(:question, user: user, node: weak_node, source_material: material),
                             node: weak_node)
      3.times { create(:evidence_record, user: user, node: strong_node, outcome: "correct") }
    end

    # Captures the user prompt the command built (the adapter seam's
    # stub-ability contract, ticket 01 — the adapter receives the messages
    # positionally) and answers with the given payload. The payload is
    # explicit at every call site so the lazy question factories never
    # create stray plan nodes behind the quota math's back.
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
      # T5's default-safe promise (ticket 05): targeting ABSENT keeps the
      # pre-T5 prompt shape byte-for-byte — `quota_note`'s blank branch and the
      # untouched template must never drift. This pin is the FULL-STRING eq a
      # regression cannot slip past: any reworded line, lost blank line, or
      # quota-note leak fails here even with every other spec green. The
      # literal is 738eaf0's Prompts.quiz (the pre-T5 template) with this
      # fixture's assembled plan_scope text interpolated where the command
      # interpolates it.
      it "builds the EXACT pre-T5 template for a plan-scope call — full-string eq, no quota note" do
        prompt = generated_prompt(targeting: nil, payload: fenced({ questions: [ question_payload ] }))

        expected = <<~PROMPT
          Study material context (the ONLY allowed source):
          ---
          #{Ai::ContextAssembler.plan_scope(plan).text}
          ---


          Generate exactly 5 quiz questions from ONLY the material above.
          Mode "open": every question is kind "open" (free-text answer).
          Every question MUST carry:
          - "nodeId": one of the [node id=…] values above (attribution, AD-6).
          - "kind": "open" or "choice".
          - "prompt", "explanation": the question and its teaching explanation.
          - "sourceMaterialId" + "sourceSectionId": the [material id=…] and [section id=…] the question's answer is grounded in (provenance, FR-18).
          - "keywords": the key terms a correct answer must use (open-answer grading input).
          Choice questions additionally carry "options" (2–4 strings) and "correctOptionIndex" (0-based Integer).
          Write every user-facing string in 简体中文.

          Reply ONLY with JSON: {"questions":[{"nodeId":"…","kind":"open","prompt":"…","options":null,"correctOptionIndex":null,"sourceMaterialId":"…","sourceSectionId":"…","keywords":["…"],"explanation":"…"}]}
        PROMPT
        # Two blank lines between the context fence and "Generate": the empty
        # notes slot (context untruncated + quota note absent) is part of the
        # pinned shape.
        aggregate_failures do
          expect(prompt).to eq(expected)
          expect(prompt).not_to include("Weak-spot quota plan")
        end
      end
    end

    describe "targeting without a nodeId (the weak-spot quota shape)" do
      it "carries the plan_scope context verbatim and the deterministic quota plan" do
        prompt = generated_prompt(targeting: {}, payload: fenced({ questions: [ question_payload(node_id: weak_node.id) ] }))

        aggregate_failures do
          # FR-18 invariant: the assembled context IS the plan-scope output —
          # the same text ContextAssembler.plan_scope publishes (T2's provably
          # pin-free pool), quoted into the prompt between its markers.
          expect(prompt).to include(Ai::ContextAssembler.plan_scope(plan).text)
          # The quota plan: the recorded weights (4.0 for score-0 + mistake
          # bonus, 1.0 for score-100) over the default 5 questions → 4 / 1.
          expect(prompt).to include("[node id=#{weak_node.id}] Weak node — exactly 4 questions")
          expect(prompt).to include("[node id=#{strong_node.id}] Strong node — exactly 1 question")
          # The quota node set == the plan's node set (both candidates present).
          expect(prompt.scan(/\[node id=/).count).to be >= 2
        end
      end

      it "still consumes exactly ONE cap call (AD-16 — no new AI surface)" do
        allow(adapter).to receive(:complete).and_return(fenced({ questions: [ question_payload ] }))

        expect(call(targeting: {})).to be_success
        expect(user.ai_usage_counters.sole.call_count).to eq(1)
      end
    end

    describe "targeting with a nodeId (the node Quick Test scope)" do
      it "assembles node_scope, keeps only the node's questions, and attributes the session to the plan" do
        create(:material, user: user, plan: plan, attachment_scope: "node", node: weak_node, sections: [
          { "id" => "pin-a", "title" => "Pinned to weak", "text" => "WEAK-PINNED-TEXT" }
        ])
        strong_pin = create(:material, user: user, plan: plan, attachment_scope: "node", node: strong_node, sections: [
          { "id" => "pin-b", "title" => "Pinned to strong", "text" => "STRONG-PINNED-SECRET-TEXT" }
        ])
        payload = { questions: [
          question_payload(node_id: weak_node.id),                                       # usable: the node + a plan-wide material
          question_payload(node_id: strong_node.id),                                     # foreign node → dropped
          question_payload(node_id: weak_node.id, material_id: strong_pin.id, section_id: "pin-b") # ANOTHER node's pin → dropped (FR-18)
        ] }
        allow(adapter).to receive(:complete).and_return(payload.to_json)

        result = call(plan_id: nil, targeting: { node_id: weak_node.id })
        expect(result).to be_success
        session = result.value![:session]
        expect(session.plan_id).to eq(plan.id) # the session still owns ONE plan (AD-6)
        expect(session.task_id).to be_nil
        questions = result.value![:questions]
        expect(questions.length).to eq(1)
        expect(questions.sole.node_id).to eq(weak_node.id)
        expect(user.ai_usage_counters.sole.call_count).to eq(1)
      end

      it "grounds the prompt on node_scope alone: own pins ride, other pins provably absent" do
        create(:material, user: user, plan: plan, attachment_scope: "node", node: weak_node, sections: [
          { "id" => "pin-a", "title" => "Pinned to weak", "text" => "WEAK-PINNED-TEXT" }
        ])
        create(:material, user: user, plan: plan, attachment_scope: "node", node: strong_node, sections: [
          { "id" => "pin-b", "title" => "Pinned to strong", "text" => "STRONG-PINNED-SECRET-TEXT" }
        ])
        prompt = generated_prompt(plan_id: nil, targeting: { node_id: weak_node.id },
                                  payload: fenced({ questions: [ question_payload(node_id: weak_node.id) ] }))

        aggregate_failures do
          expect(prompt).to include(Ai::ContextAssembler.node_scope(plan, weak_node).text)
          expect(prompt).to include("WEAK-PINNED-TEXT")
          expect(prompt).not_to include("STRONG-PINNED-SECRET-TEXT")
          expect(prompt).to include("[node id=#{weak_node.id}")
          expect(prompt).not_to include("[node id=#{strong_node.id}")
          expect(prompt).not_to include("quota plan") # the node scope needs no quota layer
        end
      end
    end

    describe "validation (nothing is spent)" do
      it "refuses targeting.nodeId alongside a plan or task scope" do
        allow(adapter).to receive(:complete)
        aggregate_failures do
          expect(call(targeting: { node_id: weak_node.id }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(plan_id: nil, task_id: create(:study_task, user: user).id,
                      targeting: { node_id: weak_node.id }).failure.code).to eq(:VALIDATION_FAILED)
        end
        expect(adapter).not_to have_received(:complete)
        expect(user.ai_usage_counters).to be_empty
      end

      it "resolves the node through current_user: foreign and malformed read NOT_FOUND" do
        other_user = create(:user)
        foreign_node = create(:knowledge_node, user: other_user, plan: create(:study_plan, user: other_user))
        allow(adapter).to receive(:complete)
        aggregate_failures do
          expect(call(plan_id: nil, targeting: { node_id: foreign_node.id }).failure.code).to eq(:NOT_FOUND)
          expect(call(plan_id: nil, targeting: { node_id: "not-a-uuid" }).failure.code).to eq(:NOT_FOUND)
        end
        expect(adapter).not_to have_received(:complete)
      end

      it "refuses a task node under targeting (a task quiz already has its scope)" do
        task_node = create(:knowledge_node, user: user, title: "Task-owned node")
        create(:study_task, user: user, node: task_node)
        allow(adapter).to receive(:complete)

        result = call(plan_id: nil, targeting: { node_id: task_node.id })
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:message]).to include("plan node")
        expect(adapter).not_to have_received(:complete)
      end

      it "refuses targeting: {} with no scope at all" do
        allow(adapter).to receive(:complete)

        result = call(plan_id: nil, task_id: nil, targeting: {})
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(adapter).not_to have_received(:complete)
      end

      # Blank ≠ absent: a present-but-blank nodeId (""/whitespace) must not
      # normalize into the weak-spot quota shape (the blank planId refusal's
      # mirror — the input is either without a nodeId entirely or carries a
      # real one). Pinned on BOTH scopes: the plan scope (where the silent
      # quota shape would engage) and the task scope (where it would be
      # silently ignored).
      it "refuses a present-but-blank targeting.nodeId on a plan or task scope (no silent normalization)" do
        allow(adapter).to receive(:complete)
        aggregate_failures do
          expect(call(targeting: { node_id: "" }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(targeting: { node_id: "   " }).failure.code).to eq(:VALIDATION_FAILED)
          expect(call(plan_id: nil, task_id: create(:study_task, user: user).id,
                      targeting: { node_id: "" }).failure.code).to eq(:VALIDATION_FAILED)
        end
        expect(adapter).not_to have_received(:complete)
        expect(user.ai_usage_counters).to be_empty
      end
    end

    it "replays an owned session without a provider call even when targeting rides" do
      allow(adapter).to receive(:complete).and_raise(Ai::ProviderError, "must not be called")
      create(:quiz_session, user: user, id: client_uuid, mode: "choice")

      result = call(mode: "open", targeting: {})
      expect(result).to be_success
      expect(result.value![:session].mode).to eq("choice")
      expect(user.ai_usage_counters).to be_empty
    end

    it "ignores an empty targeting hash on a task scope (today's behavior — a task is already node-scoped)" do
      task_node = create(:knowledge_node, user: user, title: "Task node")
      task_material = create(:material, user: user, sections: [ { "id" => "t-sec", "title" => "T", "text" => "task text" } ])
      task = create(:study_task, user: user, node: task_node, material: task_material)
      payload = fenced({ questions: [ question_payload(node_id: task.node.id, material_id: task.material.id, section_id: "t-sec") ] })

      prompt = generated_prompt(targeting: {}, payload: payload, plan_id: nil, task_id: task.id)

      aggregate_failures do
        expect(prompt).not_to include("quota plan")
        expect(prompt).to include(Ai::ContextAssembler.task_scope(task).text)
      end
    end
  end
end
