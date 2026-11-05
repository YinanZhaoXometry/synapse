# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL study focus surface (epic-13 T4, FR-17)", type: :request do
  # The wire behavior: auth guard, the user-scoped studyFocus read (the
  # active set or null, uniform NOT_FOUND), and the generateStudyFocus
  # payload shape + CAP_REACHED on the wire. The command underneath has its
  # own direct spec (spec/commands/ai/generate_study_focus_command_spec.rb);
  # the adapter is stubbed at the seam (ticket 01's stub-ability contract).
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
    it "answers UNAUTHORIZED without a token" do
      uuid = SecureRandom.uuid
      operations = [
        "query { studyFocus(materialId: \"#{uuid}\") { id } }",
        "mutation { generateStudyFocus(input: { clientUuid: \"#{uuid}\", language: \"zh\", " \
          "materialId: \"#{uuid}\" }) { studyFocusSet { id } } }"
      ]
      operations.each do |operation|
        expect(error_code(graphql(operation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "studyFocus(materialId:)" do
    it "returns the caller's active set with its items and generation" do
      user, token = user_with_token("focus-reader@example.com")
      material = create(:material, user: user)
      set = create(:study_focus_set, user: user, material: material, generation: 2, items: [
        { "id" => "item-1", "title" => "任期与领导者", "detail" => "每个任期至多一个领导者。",
          "sourceRange" => { "page" => 3, "start" => 12, "end" => 40, "quote" => "leader election" } }
      ])

      result = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query StudyFocus($materialId: String!) {
            studyFocus(materialId: $materialId) {
              id materialId generation items { id title detail sourceRange } createdAt updatedAt
            }
          }
        GRAPHQL
      )
      focus = result.dig("data", "studyFocus")
      aggregate_failures do
        expect(focus["id"]).to eq(set.id)
        expect(focus["materialId"]).to eq(material.id)
        expect(focus["generation"]).to eq(2)
        expect(focus["items"]).to eq([
          { "id" => "item-1", "title" => "任期与领导者", "detail" => "每个任期至多一个领导者。",
            "sourceRange" => { "page" => 3, "start" => 12, "end" => 40, "quote" => "leader election" } }
        ])
        expect(focus["createdAt"]).to be_present
        expect(focus["updatedAt"]).to be_present
      end
    end

    it "answers null when the material was never distilled" do
      user, token = user_with_token("focus-null@example.com")
      material = create(:material, user: user)

      result = graphql(
        "query { studyFocus(materialId: \"#{material.id}\") { id } }", token: token
      )
      expect(result.dig("data", "studyFocus")).to be_nil
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material id" do
      user, token = user_with_token("focus-scoped@example.com")
      create(:material, user: user)
      foreign = create(:material, user: create(:user))

      expect(error_code(graphql("query { studyFocus(materialId: \"#{foreign.id}\") { id } }", token: token))).to eq("NOT_FOUND")
      expect(error_code(graphql("query { studyFocus(materialId: \"#{SecureRandom.uuid}\") { id } }", token: token))).to eq("NOT_FOUND")
      expect(error_code(graphql("query { studyFocus(materialId: \"nope\") { id } }", token: token))).to eq("NOT_FOUND")
    end
  end

  describe "generateStudyFocus" do
    it "returns the persisted set over the wire; CAP_REACHED rides the closed enum" do
      user, token = user_with_token("focus-writer@example.com")
      material = create(:material, user: user)
      create(:annotation, :markdown, user: user, material: material)
      allow(adapter).to receive(:complete).and_return(
        '{"items":[{"title":"任期与领导者","detail":"每个任期至多一个领导者。","sourceAnnotationIndex":1}]}'
      )

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, language: "zh", materialId: material.id } }, token: token
          mutation GenerateStudyFocus($input: GenerateStudyFocusInput!) {
            generateStudyFocus(input: $input) {
              studyFocusSet { id generation items { title detail sourceRange } }
            }
          }
        GRAPHQL
      )
      focus = result.dig("data", "generateStudyFocus", "studyFocusSet")
      aggregate_failures do
        expect(focus["generation"]).to eq(1)
        expect(focus["items"]).to eq([
          { "title" => "任期与领导者", "detail" => "每个任期至多一个领导者。",
            "sourceRange" => { "sectionId" => "sec-1", "start" => 0, "end" => 34, "quote" => "Scoping, commands, and the spine ER." } }
        ])
      end

      user.ai_usage_counters.sole.update!(call_count: 50) # the first call consumed one
      capped = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, language: "zh", materialId: material.id } }, token: token
          mutation GenerateStudyFocus($input: GenerateStudyFocusInput!) {
            generateStudyFocus(input: $input) { studyFocusSet { id } }
          }
        GRAPHQL
      )
      expect(error_code(capped)).to eq("CAP_REACHED")
    end

    it "answers VALIDATION_FAILED honestly when the material has no annotations to distill" do
      user, token = user_with_token("focus-gate@example.com")
      material = create(:material, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: SecureRandom.uuid, language: "zh", materialId: material.id } }, token: token
          mutation GenerateStudyFocus($input: GenerateStudyFocusInput!) {
            generateStudyFocus(input: $input) { studyFocusSet { id } }
          }
        GRAPHQL
      )
      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end
  end
end
