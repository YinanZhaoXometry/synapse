# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL importDocument mutation (epic P2-8 ticket 03)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern). The command underneath has its own direct spec
  # (spec/commands/import/import_document_command_spec.rb — the cascade,
  # idempotency, and integrity pins); this file pins the WIRE behavior:
  # the auth guard, the payload shape through the real input objects
  # (camelCase → underscore keys), and the closed-enum failures.

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql("mutation { importDocument(input: { document: {} }) { imported skipped } }")

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "the happy path" do
    it "imports a small document over the wire and replays it as a pure skip" do
      user, token = user_with_token("importer@example.com")

      first = graphql(
        <<~GRAPHQL, variables: { input: { document: import_document_input } }, token: token
          mutation Import($input: ImportDocumentInput!) {
            importDocument(input: $input) { imported skipped }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(first)).to be_nil
        expect(first.dig("data", "importDocument", "imported")).to eq(3)
        expect(first.dig("data", "importDocument", "skipped")).to eq(0)
        # The rows landed under their client uuids.
        expect(user.study_plans.exists?(id: import_document_input[:plans][0][:id])).to be(true)
        expect(user.materials.exists?(id: import_document_input[:materials][0][:id])).to be(true)
        # Byteless by contract — the re-attach invite owns the bytes.
        expect(user.materials.find(import_document_input[:materials][0][:id]).original).not_to be_attached
      end

      replay = graphql(
        <<~GRAPHQL, variables: { input: { document: import_document_input } }, token: token
          mutation Import($input: ImportDocumentInput!) {
            importDocument(input: $input) { imported skipped }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(replay)).to be_nil
        expect(replay.dig("data", "importDocument", "imported")).to eq(0)
        expect(replay.dig("data", "importDocument", "skipped")).to eq(3)
        expect(user.materials.count).to eq(1)
      end
    end

    it "answers VALIDATION_FAILED, writing nothing, for a uuid owned by another user (FR-4)" do
      user, token = user_with_token("import-conflict@example.com")
      foreign_material = create(:material, user: create(:user))

      poisoned = import_document_input
      poisoned[:materials][0][:id] = foreign_material.id

      result = graphql(
        <<~GRAPHQL, variables: { input: { document: poisoned } }, token: token
          mutation Import($input: ImportDocumentInput!) {
            importDocument(input: $input) { imported skipped }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(result)).to eq("VALIDATION_FAILED")
        expect(user.study_plans.count).to eq(0)
        expect(user.materials.count).to eq(0)
      end
    end
  end

  private

  # The wire payload in the mutation's camelCase — what the real client
  # sends (Types::DocumentInput#to_h underscore-and-symbolizes it for the
  # command; the direct spec pins that shape).
  def import_document_input
    @import_document_input ||= {
      version: 1,
      onboardingComplete: true,
      plans: [ { id: "11111111-1111-4111-8111-111111111111", topic: "Wire plan", goal: nil } ],
      nodes: [ { id: "22222222-2222-4222-8222-222222222222", title: "Scoping", stage: nil,
                order: 0, planId: "11111111-1111-4111-8111-111111111111", taskId: nil } ],
      materials: [ { id: "33333333-3333-4333-8333-333333333333", title: "Wire notes.pdf",
                    kind: "pdf", sizeBytes: 42, planId: "11111111-1111-4111-8111-111111111111",
                    taskId: nil, parseState: "parsed", parseFailureReason: nil,
                    sections: [ { id: "page-1", title: "Page 1", text: "Wire text." } ] } ],
      tasks: [], sessions: [], questions: [], evidence: [], flashcards: [], mistakes: [],
      readingProgress: [], chatThreads: [], sectionMarkings: []
    }
  end

  def user_with_token(email)
    user = create(:user, email: email, password: "known-password-123")
    result = graphql("mutation { login(input: { email: \"#{email}\", password: \"known-password-123\" }) { token } }")
    [ user, result.dig("data", "login", "token") ]
  end
end
