# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL server-side AI mutations (epic P2-5 ticket 03)", type: :request do
  # The wire behavior: auth guard, typed failure codes (CAP_REACHED on the
  # wire), and the payload shapes. The commands underneath have their own
  # direct specs (spec/commands/ai/); the adapter is stubbed at the seam
  # (ticket 01's stub-ability contract — no live provider calls in CI).
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

  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token on all four AI mutations" do
      uuid = SecureRandom.uuid
      mutations = [
        "mutation { generateQuiz(input: { clientUuid: \"#{uuid}\", mode: \"open\", language: \"zh\", " \
          "planId: \"#{uuid}\" }) { session { id } } }",
        "mutation { generateFlashcards(input: { materialId: \"#{uuid}\", language: \"zh\" }) { cards { id } } }",
        "mutation { gradeOpenAnswer(input: { questionId: \"#{uuid}\", answer: \"a\", language: \"zh\" }) { gradedAnswer { outcome } } }",
        "mutation { createStreamTicket(input: { op: \"proposal\", language: \"zh\", topic: \"t\" }) { token } }"
      ]
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "generateQuiz" do
    it "returns the persisted session and questions; CAP_REACHED rides the closed enum" do
      user, token = user_with_token("ai-quiz@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "S", "text" => "body" }
      ])
      allow(adapter).to receive(:complete).and_return({ questions: [
        { nodeId: node.id, kind: "choice", prompt: "Q?", options: %w[a b], correctOptionIndex: 1,
          sourceMaterialId: material.id, sourceSectionId: "sec-1", keywords: [ "k" ], explanation: "E" }
      ] }.to_json)

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "choice", language: "en", planId: plan.id } }, token: token
          mutation GenerateQuiz($input: GenerateQuizInput!) {
            generateQuiz(input: $input) {
              session { id planId mode }
              questions { id nodeId kind prompt options correctOptionIndex sourceSectionId }
            }
          }
        GRAPHQL
      )
      payload = result.dig("data", "generateQuiz")
      expect(payload["session"]["mode"]).to eq("choice")
      expect(payload["questions"].sole["kind"]).to eq("choice")
      expect(payload["questions"].sole["correctOptionIndex"]).to eq(1)

      user.ai_usage_counters.sole.update!(call_count: 50) # the first call consumed one
      capped = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "open", language: "zh", planId: plan.id } }, token: token
          mutation GenerateQuiz($input: GenerateQuizInput!) {
            generateQuiz(input: $input) { session { id } }
          }
        GRAPHQL
      )
      expect(error_code(capped)).to eq("CAP_REACHED")
    end
  end

  describe "generateQuiz — material scope (epic-13 T2, the reader's Quick Test)" do
    it "generates over the wire with sectionIds + targetCount and attributes to the section's mapped node" do
      user, token = user_with_token("ai-quicktest@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan, sections: [
        { "id" => "sec-1", "title" => "S", "text" => "body" },
        { "id" => "sec-2", "title" => "T", "text" => "unmapped body" }
      ])
      create(:material_node_mapping, :confirmed, user: user, material: material, node: node, section_id: "sec-1")
      allow(adapter).to receive(:complete).and_return({ questions: [
        { nodeId: node.id, kind: "open", prompt: "Q?", sourceMaterialId: material.id, sourceSectionId: "sec-1",
          keywords: [ "k" ], explanation: "E" }
      ] }.to_json)

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "open", language: "zh", materialId: material.id, sectionIds: [ "sec-1" ], targetCount: 4 } }, token: token
          mutation GenerateQuiz($input: GenerateQuizInput!) {
            generateQuiz(input: $input) {
              session { id planId mode }
              questions { id nodeId sourceSectionId }
            }
          }
        GRAPHQL
      )
      payload = result.dig("data", "generateQuiz")
      aggregate_failures do
        expect(payload["session"]["planId"]).to eq(plan.id)
        expect(payload["questions"].sole["nodeId"]).to eq(node.id)
        expect(payload["questions"].sole["sourceSectionId"]).to eq("sec-1")
      end
    end

    it "surfaces the gate and the xor through the closed enum" do
      user, token = user_with_token("ai-quicktest-gate@example.com")
      plan = create(:study_plan, user: user)
      material = create(:material, user: user, plan: plan, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      # No confirmed mapping → the gate refuses; materialId+planId → the xor refuses.
      gated = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "open", language: "zh", materialId: material.id } }, token: token
          mutation GenerateQuiz($input: GenerateQuizInput!) {
            generateQuiz(input: $input) { session { id } }
          }
        GRAPHQL
      )
      expect(error_code(gated)).to eq("VALIDATION_FAILED")

      xored = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, mode: "open", language: "zh", materialId: material.id, planId: plan.id } }, token: token
          mutation GenerateQuiz($input: GenerateQuizInput!) {
            generateQuiz(input: $input) { session { id } }
          }
        GRAPHQL
      )
      expect(error_code(xored)).to eq("VALIDATION_FAILED")
      expect(user.ai_usage_counters).to be_empty
    end
  end

  describe "generateFlashcards" do
    it "returns the created deck over the wire" do
      user, token = user_with_token("ai-flashcards@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      allow(adapter).to receive(:complete).and_return({ cards: [ { front: "F", back: "B" } ] }.to_json)

      result = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, language: "zh" } }, token: token
          mutation GenerateFlashcards($input: GenerateFlashcardsInput!) {
            generateFlashcards(input: $input) {
              cards { id materialId front back nodeId }
            }
          }
        GRAPHQL
      )
      cards = result.dig("data", "generateFlashcards", "cards")
      expect(cards.sole["front"]).to eq("F")
      expect(cards.sole["materialId"]).to eq(material.id)
      expect(cards.sole["nodeId"]).to be_nil
    end

    it "rides the cap through the seam — CAP_REACHED on the wire (epic P3-17 ticket 06)" do
      user, token = user_with_token("ai-flashcards-cap@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      create(:ai_usage_counter, user: user, call_count: 50) # DailyCap.limit, today (UTC)
      allow(adapter).to receive(:complete)

      result = graphql(
        "mutation { generateFlashcards(input: { materialId: \"#{material.id}\", language: \"zh\" }) " \
          "{ cards { id } } }",
        token: token
      )
      expect(error_code(result)).to eq("CAP_REACHED")
      expect(adapter).not_to have_received(:complete)
    end

    it "answers NOT_FOUND for a foreign material without spending the call" do
      _owner, token = user_with_token("ai-flashcards-foreign@example.com")
      foreign = create(:material, user: create(:user),
                                  sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      allow(adapter).to receive(:complete)

      result = graphql(
        "mutation { generateFlashcards(input: { materialId: \"#{foreign.id}\", language: \"zh\" }) " \
          "{ cards { id } } }",
        token: token
      )
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(adapter).not_to have_received(:complete)
    end
  end

  describe "gradeOpenAnswer" do
    it "returns outcome, rationale, and the citation" do
      user, token = user_with_token("ai-grader@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "support" } ])
      question = create(:question, user: user, source_material: material, source_section_id: "sec-1")
      allow(adapter).to receive(:complete).and_return(
        { outcome: "partial", rationale: "one term", quote: "support" }.to_json
      )

      result = graphql(
        <<~GRAPHQL, variables: { input: { questionId: question.id, answer: "half right", language: "en" } }, token: token
          mutation GradeOpenAnswer($input: GradeOpenAnswerInput!) {
            gradeOpenAnswer(input: $input) {
              gradedAnswer {
                outcome
                rationale
                citation { quote locator { kind sectionId } }
              }
            }
          }
        GRAPHQL
      )
      graded = result.dig("data", "gradeOpenAnswer", "gradedAnswer")
      expect(graded["outcome"]).to eq("partial")
      expect(graded["citation"]["locator"]["kind"]).to eq("markdown")
      expect(graded["citation"]["locator"]["sectionId"]).to eq("sec-1")
    end

    it "refuses an over-bound answer with VALIDATION_FAILED before the seam (epic P3-17 ticket 06)" do
      user, token = user_with_token("ai-grader-bound@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "support" } ])
      question = create(:question, user: user, source_material: material, source_section_id: "sec-1")
      allow(adapter).to receive(:complete)

      result = graphql(
        <<~GRAPHQL, variables: { input: { questionId: question.id, answer: "a" * 20_001, language: "zh" } }, token: token
          mutation GradeOpenAnswerBound($input: GradeOpenAnswerInput!) {
            gradeOpenAnswer(input: $input) { gradedAnswer { outcome } }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(adapter).not_to have_received(:complete)
    end

    it "rides the cap through the seam — CAP_REACHED on the wire" do
      user, token = user_with_token("ai-grader-cap@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "support" } ])
      question = create(:question, user: user, source_material: material, source_section_id: "sec-1")
      create(:ai_usage_counter, user: user, call_count: 50) # DailyCap.limit, today (UTC)
      allow(adapter).to receive(:complete)

      result = graphql(
        "mutation { gradeOpenAnswer(input: { questionId: \"#{question.id}\", answer: \"a\", language: \"zh\" }) " \
          "{ gradedAnswer { outcome } } }",
        token: token
      )
      expect(error_code(result)).to eq("CAP_REACHED")
      expect(adapter).not_to have_received(:complete)
    end
  end

  describe "createStreamTicket" do
    it "mints a ticket over the wire and carries the frozen payload inputs" do
      user, token = user_with_token("ai-ticket@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])

      variables = { input: { op: "companion", language: "zh", materialId: material.id,
                             question: "这一节讲了什么？",
                             position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "view" } } }
      result = graphql(
        <<~GRAPHQL, variables: variables, token: token
          mutation CreateStreamTicket($input: CreateStreamTicketInput!) {
            createStreamTicket(input: $input) { token expiresAt }
          }
        GRAPHQL
      )
      payload = result.dig("data", "createStreamTicket")
      expect(payload["token"]).to be_present
      expect(payload["expiresAt"]).to be_present
      minted = user.stream_tickets.sole
      expect(minted.payload["material_id"]).to eq(material.id)
      expect(minted.payload["locator"]).to eq({ "kind" => "markdown", "sectionId" => "sec-1" })

      invalid = graphql(
        "mutation { createStreamTicket(input: { op: \"chat\", language: \"zh\", topic: \"t\" }) { token } }",
        token: token
      )
      expect(error_code(invalid)).to eq("VALIDATION_FAILED")
    end

    it "carries the optional selection grounding input into the payload (epic-13 T1, FR-13)" do
      user, token = user_with_token("ai-ticket-selection@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])

      variables = { input: { op: "companion", language: "zh", materialId: material.id,
                             question: "解释这个选段",
                             position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "view" },
                             selection: "Every row is scoped by user_id." } }
      result = graphql(
        <<~GRAPHQL, variables: variables, token: token
          mutation CreateStreamTicket($input: CreateStreamTicketInput!) {
            createStreamTicket(input: $input) { token expiresAt }
          }
        GRAPHQL
      )
      expect(result.dig("data", "createStreamTicket", "token")).to be_present
      minted = user.stream_tickets.sole
      expect(minted.payload["selection"]).to eq("Every row is scoped by user_id.")
    end

    it "mints plan_companion tickets with the planId/mistakeEntryId inputs (epic P2-12 T3)" do
      user, token = user_with_token("ai-ticket-plan@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      question = create(:question, user: user, node: node)
      entry = create(:mistake_entry, user: user, question: question, node: node)

      variables = { input: { op: "plan_companion", language: "en", planId: plan.id,
                             question: "重点是什么？", mistakeEntryId: entry.id } }
      result = graphql(
        <<~GRAPHQL, variables: variables, token: token
          mutation CreateStreamTicket($input: CreateStreamTicketInput!) {
            createStreamTicket(input: $input) { token expiresAt }
          }
        GRAPHQL
      )
      expect(result.dig("data", "createStreamTicket", "token")).to be_present
      minted = user.stream_tickets.sole
      expect(minted.payload).to eq({
        "plan_id" => plan.id,
        "question" => "重点是什么？",
        "language" => "en",
        "mistake_entry_id" => entry.id
      })

      foreign = graphql(
        "mutation { createStreamTicket(input: { op: \"plan_companion\", language: \"zh\", " \
          "planId: \"#{SecureRandom.uuid}\", question: \"q\" }) { token } }",
        token: token
      )
      expect(error_code(foreign)).to eq("NOT_FOUND")
    end

    it "answers RATE_LIMITED once MAX_LIVE_TICKETS unconsumed tickets are live (epic P3-17 ticket 06)" do
      user, token = user_with_token("ai-ticket-flood@example.com")
      material = create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      create_list(:stream_ticket, Ai::CreateStreamTicketCommand::MAX_LIVE_TICKETS, user: user)

      variables = { input: { op: "companion", language: "zh", materialId: material.id,
                             question: "还在吗？",
                             position: { locator: { kind: "markdown", sectionId: "sec-1" }, text: "view" } } }
      result = graphql(
        <<~GRAPHQL, variables: variables, token: token
          mutation CreateStreamTicketFlood($input: CreateStreamTicketInput!) {
            createStreamTicket(input: $input) { token }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("RATE_LIMITED")
      expect(user.stream_tickets.count).to eq(Ai::CreateStreamTicketCommand::MAX_LIVE_TICKETS) # nothing minted
    end
  end

  describe "generateQuiz targeting (epic P2-10 T5)" do
    # The schema movement over the wire: GenerateQuizInput carries the
    # optional targeting { nodeId } (QuizTargetingInput); the command's
    # validation codes surface 1:1 through the closed enum.

    def quiz_variables(uuid, extra)
      { input: { clientUuid: uuid, mode: "open", language: "zh", planId: nil, **extra } }
    end

    it "scopes the generation to the targeting node (the Quick Test loop) and attributes the session to the plan" do
      user, token = user_with_token("ai-targeting@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan, title: "Target node")
      create(:knowledge_node, user: user, plan: plan, title: "Other node")
      material = create(:material, user: user, plan: plan, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      allow(adapter).to receive(:complete).and_return({ questions: [
        { nodeId: node.id, kind: "open", prompt: "Q?", options: nil, correctOptionIndex: nil,
          sourceMaterialId: material.id, sourceSectionId: "sec-1", keywords: [ "k" ], explanation: "E" }
      ] }.to_json)

      result = graphql(
        <<~GRAPHQL, variables: quiz_variables(SecureRandom.uuid, { targeting: { nodeId: node.id } }), token: token
          mutation GenerateQuizTargeted($input: GenerateQuizInput!) {
            generateQuiz(input: $input) {
              session { id planId mode }
              questions { id nodeId kind prompt }
            }
          }
        GRAPHQL
      )
      payload = result.dig("data", "generateQuiz")
      aggregate_failures do
        expect(payload["session"]["planId"]).to eq(plan.id)
        expect(payload["questions"].sole["nodeId"]).to eq(node.id)
      end
      # Still exactly ONE cap-counted provider call (AD-16).
      expect(user.ai_usage_counters.sole.call_count).to eq(1)
    end

    it "refuses targeting.nodeId alongside a plan scope with the closed VALIDATION_FAILED" do
      user, token = user_with_token("ai-targeting-xor@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)

      result = graphql(
        <<~GRAPHQL, variables: quiz_variables(SecureRandom.uuid, { planId: plan.id, targeting: { nodeId: node.id } }), token: token
          mutation GenerateQuizXor($input: GenerateQuizInput!) {
            generateQuiz(input: $input) { session { id } }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "refuses a blank targeting.nodeId over the wire (blank ≠ absent — no silent weak-spot shape)" do
      user, token = user_with_token("ai-targeting-blank@example.com")
      plan = create(:study_plan, user: user)
      create(:material, user: user, plan: plan, sections: [ { "id" => "sec-1", "title" => "S", "text" => "body" } ])
      allow(adapter).to receive(:complete)

      result = graphql(
        <<~GRAPHQL, variables: quiz_variables(SecureRandom.uuid, { planId: plan.id, targeting: { nodeId: "" } }), token: token
          mutation GenerateQuizBlankTarget($input: GenerateQuizInput!) {
            generateQuiz(input: $input) { session { id } }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(adapter).not_to have_received(:complete)
      expect(user.ai_usage_counters).to be_empty
    end
  end
end
