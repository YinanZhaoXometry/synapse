# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL chat + reading progress + section marking operations (epic P2-3 ticket 04)",
               type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The commands underneath
  # have their own direct specs (spec/commands/chat/, spec/commands/progress/,
  # spec/commands/markings/); this file pins the wire behavior — the jsonb
  # round-trip keys especially (delta 7: TS keys verbatim).

  describe "the auth guard on every chat/progress/marking operation (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token on all seven operations" do
      uuid = "00000000-0000-0000-0000-000000000000"
      queries = [
        'query { chatThread(materialId: "' + uuid + '") { id } }',
        'query { readingProgress(materialId: "' + uuid + '") { id } }',
        "query { readingProgressList { id } }"
      ]
      mutations = [
        'mutation { appendChatMessage(input: { materialId: "' + uuid +
          '", message: { role: "user", text: "hi", citations: [] } }) { message { id } } }',
        'mutation { saveReadingProgress(input: { materialId: "' + uuid +
          '", position: { locator: { kind: "pdf", page: 1 }, text: "t" } }) { readingProgress { id } } }',
        'mutation { claimSection(input: { materialId: "' + uuid +
          '", sectionId: "sec-1" }) { sectionMarking { id } } }',
        'mutation { unclaimSection(input: { materialId: "' + uuid +
          '", sectionId: "sec-1" }) { sectionMarking { id } } }'
      ]

      queries.each do |query|
        expect(error_code(graphql(query))).to eq("UNAUTHORIZED")
      end
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "appendChatMessage mutation + chatThread query" do
    it "appends the message and round-trips the thread with citations verbatim (TS keys, delta 7)" do
      user, token = user_with_token("chat-writer@example.com")
      material = create(:material, user: user)

      first = graphql(
        <<~GRAPHQL, variables: append_input(material.id, "Explain section 2 again."), token: token
          mutation Append($input: AppendMessageInput!) {
            appendChatMessage(input: $input) {
              message { id role text citations { kind page sectionId } createdAt }
            }
          }
        GRAPHQL
      )

      payload = first.dig("data", "appendChatMessage", "message")
      aggregate_failures do
        expect(payload["role"]).to eq("user")
        expect(payload["text"]).to eq("Explain section 2 again.")
        expect(payload["citations"]).to eq([
          { "kind" => "markdown", "page" => nil, "sectionId" => "sec-2" },
          { "kind" => "pdf", "page" => 3, "sectionId" => nil }
        ])
        expect(payload["id"]).to match(Accounts::UUID_REGEX)
        expect(payload["createdAt"]).to be_present
      end

      second = graphql(
        <<~GRAPHQL, variables: append_input(material.id, "The companion answer.", role: "companion"), token: token
          mutation Append($input: AppendMessageInput!) {
            appendChatMessage(input: $input) { message { role } }
          }
        GRAPHQL
      )
      expect(second.dig("data", "appendChatMessage", "message", "role")).to eq("companion")

      thread = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) {
            chatThread(materialId: $materialId) {
              id materialId updatedAt
              messages { id role text citations { kind page sectionId } createdAt }
            }
          }
        GRAPHQL
      )

      data = thread.dig("data", "chatThread")
      aggregate_failures do
        expect(data["materialId"]).to eq(material.id)
        expect(data["messages"].map { |m| m["text"] })
          .to eq([ "Explain section 2 again.", "The companion answer." ])
        expect(data["messages"].first["citations"].first["sectionId"]).to eq("sec-2")
      end
    end

    it "answers null for a thread that has no messages yet (the getChatThread mirror)" do
      user, token = user_with_token("chat-empty@example.com")
      material = create(:material, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) { chatThread(materialId: $materialId) { id } }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(result)).to be_nil
        expect(result.dig("data", "chatThread")).to be_nil
      end
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material on both operations" do
      user, token = user_with_token("chat-scoper@example.com")
      foreign_material = create(:material, user: create(:user))

      aggregate_failures do
        expect(error_code(graphql(
          'query($materialId: String!) { chatThread(materialId: $materialId) { id } }',
          variables: { materialId: foreign_material.id }, token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          'query($materialId: String!) { chatThread(materialId: $materialId) { id } }',
          variables: { materialId: SecureRandom.uuid }, token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          'query($materialId: String!) { chatThread(materialId: $materialId) { id } }',
          variables: { materialId: "garbage" }, token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          "mutation { appendChatMessage(input: { materialId: \"#{SecureRandom.uuid}\", " \
          "message: { role: \"user\", text: \"hi\", citations: [] } }) { message { id } } }",
          token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          "mutation { appendChatMessage(input: { materialId: \"garbage\", " \
          "message: { role: \"user\", text: \"hi\", citations: [] } }) { message { id } } }",
          token: token
        ))).to eq("NOT_FOUND")
      end
    end

    it "fails VALIDATION_FAILED for a bad role over the wire" do
      user, token = user_with_token("chat-role@example.com")
      material = create(:material, user: user)

      result = graphql(
        "mutation { appendChatMessage(input: { materialId: \"#{material.id}\", " \
        "message: { role: \"assistant\", text: \"hi\", citations: [] } }) { message { id } } }",
        token: token
      )

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end
  end

  # The plan scope over the wire (epic-25 T1): planChatThread is a NEW
  # query field (chatThread stays frozen — its typed clients untouched) and
  # appendChatMessage grows the plan addressing mode (materialId
  # required→optional is wire-compatible; the command's exactly-one rule is
  # the gate).
  describe "planChatThread query + appendChatMessage plan addressing (epic-25 T1)" do
    def plan_append_input(plan_id, text, role: "user")
      {
        input: {
          planId: plan_id,
          message: { role: role, text: text, citations: [] }
        }
      }
    end

    it "appends to the plan thread and round-trips it off planChatThread (planId set, materialId null)" do
      user, token = user_with_token("plan-chat@example.com")
      plan = create(:study_plan, user: user)

      first = graphql(
        <<~GRAPHQL, variables: plan_append_input(plan.id, "Where should I start?"), token: token
          mutation Append($input: AppendMessageInput!) {
            appendChatMessage(input: $input) { message { id role text createdAt } }
          }
        GRAPHQL
      )

      payload = first.dig("data", "appendChatMessage", "message")
      aggregate_failures do
        expect(payload["role"]).to eq("user")
        expect(payload["text"]).to eq("Where should I start?")
        expect(payload["id"]).to match(Accounts::UUID_REGEX)
        expect(payload["createdAt"]).to be_present
      end

      thread = graphql(
        <<~GRAPHQL, variables: { planId: plan.id }, token: token
          query($planId: String!) {
            planChatThread(planId: $planId) {
              id planId materialId updatedAt
              messages { id role text createdAt }
            }
          }
        GRAPHQL
      )

      data = thread.dig("data", "planChatThread")
      aggregate_failures do
        expect(data["planId"]).to eq(plan.id)
        expect(data["materialId"]).to be_nil
        expect(data["messages"].map { |m| m["text"] }).to eq([ "Where should I start?" ])
      end

      second = graphql(
        <<~GRAPHQL, variables: plan_append_input(plan.id, "Start with node 1.", role: "companion"), token: token
          mutation Append($input: AppendMessageInput!) {
            appendChatMessage(input: $input) { message { role } }
          }
        GRAPHQL
      )
      expect(second.dig("data", "appendChatMessage", "message", "role")).to eq("companion")

      expect(user.chat_threads.count).to eq(1)
      expect(user.chat_threads.find_by!(plan_id: plan.id).messages.length).to eq(2)
    end

    it "answers null (honest-empty) for a thread that has not started and for a foreign, unknown, or malformed plan" do
      user, token = user_with_token("plan-chat-empty@example.com")
      foreign_plan = create(:study_plan, user: create(:user))

      aggregate_failures do
        none = graphql(
          'query($planId: String!) { planChatThread(planId: $planId) { id } }',
          variables: { planId: SecureRandom.uuid }, token: token
        )
        expect(error_code(none)).to be_nil
        expect(none.dig("data", "planChatThread")).to be_nil

        foreign = graphql(
          'query($planId: String!) { planChatThread(planId: $planId) { id planId } }',
          variables: { planId: foreign_plan.id }, token: token
        )
        expect(error_code(foreign)).to be_nil
        expect(foreign.dig("data", "planChatThread")).to be_nil

        malformed = graphql(
          'query($planId: String!) { planChatThread(planId: $planId) { id } }',
          variables: { planId: "garbage" }, token: token
        )
        expect(error_code(malformed)).to be_nil
        expect(malformed.dig("data", "planChatThread")).to be_nil
      end
    end

    it "never answers the material thread through a plan address (the scopes stay separate on the wire)" do
      user, token = user_with_token("plan-chat-scope@example.com")
      material = create(:material, user: user)
      plan = create(:study_plan, user: user)
      graphql(
        <<~GRAPHQL, variables: append_input(material.id, "material-side message"), token: token
          mutation Append($input: AppendMessageInput!) {
            appendChatMessage(input: $input) { message { id } }
          }
        GRAPHQL
      )

      thread = graphql(
        <<~GRAPHQL, variables: { planId: plan.id }, token: token
          query($planId: String!) { planChatThread(planId: $planId) { id messages { text } } }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(thread)).to be_nil
        expect(thread.dig("data", "planChatThread")).to be_nil
      end
    end

    it "fails VALIDATION_FAILED (field: scope) for both or neither of materialId / planId" do
      user, token = user_with_token("plan-chat-scope-guard@example.com")
      plan = create(:study_plan, user: user)
      material = create(:material, user: user)
      message = 'message: { role: "user", text: "hi", citations: [] }'

      aggregate_failures do
        both = graphql(
          "mutation { appendChatMessage(input: { materialId: \"#{material.id}\", planId: \"#{plan.id}\", " \
          "#{message} }) { message { id } } }",
          token: token
        )
        expect(error_code(both)).to eq("VALIDATION_FAILED")
        expect(both.dig("errors", 0, "message")).to include("exactly one of material_id / plan_id")

        neither = graphql(
          "mutation { appendChatMessage(input: { #{message} }) { message { id } } }",
          token: token
        )
        expect(error_code(neither)).to eq("VALIDATION_FAILED")
      end
      expect(user.chat_threads.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign plan id on the append" do
      user, token = user_with_token("plan-chat-scoper@example.com")
      foreign_plan = create(:study_plan, user: create(:user))

      result = graphql(
        "mutation { appendChatMessage(input: { planId: \"#{foreign_plan.id}\", " \
        "message: { role: \"user\", text: \"hi\", citations: [] } }) { message { id } } }",
        token: token
      )

      expect(error_code(result)).to eq("NOT_FOUND")
    end

    it "answers UNAUTHORIZED without a token on the new query field" do
      result = graphql('query { planChatThread(planId: "00000000-0000-0000-0000-000000000000") { id } }')

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "saveReadingProgress mutation + readingProgress/readingProgressList queries" do
    it "upserts the row and round-trips the position verbatim (locator + text, TS keys)" do
      user, token = user_with_token("progress-writer@example.com")
      material = create(:material, user: user)

      first = graphql(
        <<~GRAPHQL, variables: progress_input(material.id, "sec-1", "where I stopped"), token: token
          mutation Save($input: SaveReadingProgressInput!) {
            saveReadingProgress(input: $input) {
              readingProgress { id materialId position { locator { kind page sectionId } text } updatedAt }
            }
          }
        GRAPHQL
      )

      payload = first.dig("data", "saveReadingProgress", "readingProgress")
      aggregate_failures do
        expect(payload["materialId"]).to eq(material.id)
        expect(payload["position"]["locator"]).to eq(
          { "kind" => "markdown", "page" => nil, "sectionId" => "sec-1" }
        )
        expect(payload["position"]["text"]).to eq("where I stopped")
        expect(payload["updatedAt"]).to be_present
      end

      second = graphql(
        <<~GRAPHQL, variables: progress_input(material.id, nil, "further in", page: 7), token: token
          mutation Save($input: SaveReadingProgressInput!) {
            saveReadingProgress(input: $input) {
              readingProgress { id position { locator { kind page sectionId } text } }
            }
          }
        GRAPHQL
      )

      repayload = second.dig("data", "saveReadingProgress", "readingProgress")
      aggregate_failures do
        expect(repayload["id"]).to eq(payload["id"])
        expect(repayload["position"]["locator"]).to eq(
          { "kind" => "pdf", "page" => 7, "sectionId" => nil }
        )
        expect(repayload["position"]["text"]).to eq("further in")
        expect(user.reading_progresses.count).to eq(1)
      end
    end

    it "reads one material's progress (null when none) and every progress row, own-only" do
      user, token = user_with_token("progress-reader@example.com")
      material = create(:material, user: user)
      other_material = create(:material, user: user)
      create(:reading_progress, user: user, material: material)
      create(:reading_progress, user: create(:user))

      none = graphql(
        <<~GRAPHQL, variables: { materialId: other_material.id }, token: token
          query($materialId: String!) {
            readingProgress(materialId: $materialId) { id }
          }
        GRAPHQL
      )

      one = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) {
            readingProgress(materialId: $materialId) { id materialId position { text } }
          }
        GRAPHQL
      )

      all = graphql("query { readingProgressList { id materialId } }", token: token)

      aggregate_failures do
        expect(error_code(none)).to be_nil
        expect(none.dig("data", "readingProgress")).to be_nil
        expect(one.dig("data", "readingProgress", "materialId")).to eq(material.id)
        expect(one.dig("data", "readingProgress", "position", "text")).to eq("…where the reader stopped.")
        expect(all.dig("data", "readingProgressList").map { |r| r["materialId"] }).to eq([ material.id ])
      end
    end

    it "answers NOT_FOUND for a foreign material on all three operations" do
      user, token = user_with_token("progress-scoper@example.com")
      foreign_material = create(:material, user: create(:user))

      aggregate_failures do
        expect(error_code(graphql(
          'query($materialId: String!) { readingProgress(materialId: $materialId) { id } }',
          variables: { materialId: foreign_material.id }, token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          "mutation { saveReadingProgress(input: { materialId: \"#{foreign_material.id}\", " \
          "position: { locator: { kind: \"pdf\", page: 1 }, text: \"t\" } }) { readingProgress { id } } }",
          token: token
        ))).to eq("NOT_FOUND")
      end
    end

    it "refuses position text beyond the 100,000-character cap (delta 6)" do
      user, token = user_with_token("progress-cap@example.com")
      material = create(:material, user: user)
      oversized = {
        input: {
          materialId: material.id,
          position: { locator: { kind: "pdf", page: 1 }, text: "a" * (Materials::MAX_SECTION_CHARS + 1) }
        }
      }

      result = graphql(
        <<~GRAPHQL, variables: oversized, token: token
          mutation Save($input: SaveReadingProgressInput!) {
            saveReadingProgress(input: $input) { readingProgress { id } }
          }
        GRAPHQL
      )

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end
  end

  describe "claimSection/unclaimSection mutations" do
    it "claims with a server-set claimedAt, re-claims without duplicating, and never touches evidence" do
      user, token = user_with_token("marker@example.com")
      material = create(:material, user: user)
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node)
      evidence_count = EvidenceRecord.count

      claim = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, sectionId: "sec-1" } }, token: token
          mutation Claim($input: ClaimSectionInput!) {
            claimSection(input: $input) {
              sectionMarking { id materialId sectionId claimedAt clearedAt }
            }
          }
        GRAPHQL
      )

      marking = claim.dig("data", "claimSection", "sectionMarking")
      aggregate_failures do
        expect(marking["materialId"]).to eq(material.id)
        expect(marking["sectionId"]).to eq("sec-1")
        expect(marking["claimedAt"]).to be_present
        expect(marking["clearedAt"]).to be_nil
      end

      re_claim = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, sectionId: "sec-1" } }, token: token
          mutation Claim($input: ClaimSectionInput!) {
            claimSection(input: $input) { sectionMarking { id } }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(re_claim.dig("data", "claimSection", "sectionMarking", "id")).to eq(marking["id"])
        expect(user.section_markings.count).to eq(1)
        expect(EvidenceRecord.count).to eq(evidence_count)
      end
    end

    it "unclaims by setting clearedAt (claim → unclaim → re-claim keeps history)" do
      user, token = user_with_token("unmarker@example.com")
      material = create(:material, user: user)
      claim_section(token, material.id, "sec-1")

      unclaim = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, sectionId: "sec-1" } }, token: token
          mutation Unclaim($input: UnclaimSectionInput!) {
            unclaimSection(input: $input) {
              sectionMarking { id sectionId claimedAt clearedAt }
            }
          }
        GRAPHQL
      )

      marking = unclaim.dig("data", "unclaimSection", "sectionMarking")
      aggregate_failures do
        expect(marking["claimedAt"]).to be_present
        expect(marking["clearedAt"]).to be_present
        expect(user.section_markings.count).to eq(1)
      end

      re_claim = claim_section(token, material.id, "sec-1")
      expect(user.section_markings.count).to eq(2)
      expect(re_claim["clearedAt"]).to be_nil
    end

    it "answers NOT_FOUND when there is no open claim to clear" do
      user, token = user_with_token("never-claimed@example.com")
      material = create(:material, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, sectionId: "sec-9" } }, token: token
          mutation Unclaim($input: UnclaimSectionInput!) {
            unclaimSection(input: $input) { sectionMarking { id } }
          }
        GRAPHQL
      )

      expect(error_code(result)).to eq("NOT_FOUND")
    end

    it "answers NOT_FOUND for a foreign material on both marking operations (evidence untouched)" do
      user, token = user_with_token("marking-scoper@example.com")
      foreign_material = create(:material, user: create(:user))
      evidence_count = EvidenceRecord.count

      aggregate_failures do
        expect(error_code(graphql(
          'mutation { claimSection(input: { materialId: "' + foreign_material.id +
          '", sectionId: "sec-1" }) { sectionMarking { id } } }',
          token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          'mutation { unclaimSection(input: { materialId: "' + foreign_material.id +
          '", sectionId: "sec-1" }) { sectionMarking { id } } }',
          token: token
        ))).to eq("NOT_FOUND")
      end
      expect(EvidenceRecord.count).to eq(evidence_count)
    end
  end

  private

  def claim_section(token, material_id, section_id)
    result = graphql(
      <<~GRAPHQL, variables: { input: { materialId: material_id, sectionId: section_id } }, token: token
        mutation Claim($input: ClaimSectionInput!) {
          claimSection(input: $input) { sectionMarking { id claimedAt clearedAt } }
        }
      GRAPHQL
    )
    result.dig("data", "claimSection", "sectionMarking")
  end

  def append_input(material_id, text, role: "user")
    {
      input: {
        materialId: material_id,
        message: {
          role: role,
          text: text,
          citations: [
            { kind: "markdown", sectionId: "sec-2" },
            { kind: "pdf", page: 3 }
          ]
        }
      }
    }
  end

  def progress_input(material_id, section_id, text, page: nil)
    locator = page ? { kind: "pdf", page: page } : { kind: "markdown", sectionId: section_id }
    { input: { materialId: material_id, position: { locator: locator, text: text } } }
  end
end
