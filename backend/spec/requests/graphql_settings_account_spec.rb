# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL Settings account surfaces (epic-14 T1)", type: :request do
  # The wire behavior of the three new operations — changePassword,
  # exportData, aiUsageToday (FR-30 + FR-34's display consequence). The
  # commands underneath carry their own direct specs (AD-10); this file pins
  # the auth guard, the payload shapes, the closed-enum failures, the
  # session-continuity law (stateless JWT — AD-15), and the export→import
  # round trip through the REAL input objects (camelCase → underscore).

  describe "changePassword" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql("mutation { changePassword(input: { currentPassword: \"x\", newPassword: \"y\" }) { user { id } } }")

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end

    it "changes the password, keeps the SAME token working (session survives — stateless JWT), and flips the login credential" do
      user, token = user_with_token("changer@example.com")

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            changePassword(input: { currentPassword: "#{password}", newPassword: "a-fresh-password-456" }) {
              user { id email }
            }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(result)).to be_nil
        expect(result.dig("data", "changePassword", "user", "id")).to eq(user.id)
        expect(result.dig("data", "changePassword", "user", "email")).to eq("changer@example.com")
      end

      # The session survives: the token minted BEFORE the change still
      # authenticates a follow-up operation (no revocation list — AD-15).
      after = graphql("query { aiUsageToday { callsToday dailyLimit } }", token: token)
      expect(error_code(after)).to be_nil

      # The credential flipped: the new password logs in, the old one fails.
      relogin = graphql(
        <<~GRAPHQL
          mutation {
            login(input: { email: "changer@example.com", password: "a-fresh-password-456" }) { token }
          }
        GRAPHQL
      )
      expect(relogin.dig("data", "login", "token")).to be_present

      old_login = graphql(
        <<~GRAPHQL
          mutation {
            login(input: { email: "changer@example.com", password: "#{password}" }) { token }
          }
        GRAPHQL
      )
      expect(error_code(old_login)).to eq("UNAUTHORIZED")
    end

    it "answers VALIDATION_FAILED for a wrong current password (an honest field error, not an auth failure)" do
      _, token = user_with_token("wrong-current@example.com")

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            changePassword(input: { currentPassword: "not-the-password", newPassword: "a-fresh-password-456" }) {
              user { id }
            }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(result.dig("data", "changePassword")).to be_nil
        expect(error_code(result)).to eq("VALIDATION_FAILED")
        expect(result.dig("errors", 0, "message")).to match(/current password/i)
      end
    end

    it "answers VALIDATION_FAILED for a new password under the register minimum" do
      _, token = user_with_token("weak-new@example.com")

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            changePassword(input: { currentPassword: "#{password}", newPassword: "short" }) {
              user { id }
            }
          }
        GRAPHQL
      )

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "answers RATE_LIMITED on an attempt burst (the login limiter's mechanism, mirrored)" do
      email = "burst@example.com"
      _, token = user_with_token(email)

      Accounts::LoginRateLimiter::DEFAULT_THRESHOLD.times do
        Accounts::LoginRateLimiter.attempt(email)
      end

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            changePassword(input: { currentPassword: "#{password}", newPassword: "a-fresh-password-456" }) {
              user { id }
            }
          }
        GRAPHQL
      )

      expect(error_code(result)).to eq("RATE_LIMITED")
    end
  end

  describe "exportData" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql("query { exportData { document } }")

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end

    it "returns the whole document as one JSON string in the import shape (version + every collection)" do
      user, token = user_with_token("exporter@example.com")
      Import::ImportDocumentCommand.call(current_user: user, document: settings_account_document)

      result = graphql("query { exportData { document } }", token: token)

      aggregate_failures do
        expect(error_code(result)).to be_nil
        document = JSON.parse(result.dig("data", "exportData", "document"))
        expect(document["version"]).to eq(1)
        expect(document["plans"].size).to eq(1)
        expect(document["materials"].size).to eq(1)
        expect(document["materials"].sole["title"]).to eq("Settings doc.pdf")
        expect(document.keys).to contain_exactly(
          "version", "plans", "nodes", "materials", "tasks", "sessions", "questions",
          "evidence", "flashcards", "mistakes", "sectionMarkings", "readingProgress", "chatThreads"
        )
      end
    end

    it "closes the round trip ON THE WIRE: export → importDocument on a fresh user → equal counts" do
      user, token = user_with_token("wire-exporter@example.com")
      Import::ImportDocumentCommand.call(current_user: user, document: settings_account_document)

      exported = graphql("query { exportData { document } }", token: token)
      document = JSON.parse(exported.dig("data", "exportData", "document"))

      # The import's FR-4 ownership law: the uuids must be unowned to land,
      # so the round trip models a restore — the original rows go (leaf-first
      # over the restricting FKs; class-level scoped deletes, since an
      # association-scoped delete_all would just NULLIFY the FKs), then the
      # fresh account carries them.
      EvidenceRecord.where(user_id: user.id).delete_all
      MistakeEntry.where(user_id: user.id).delete_all
      Question.where(user_id: user.id).delete_all
      Flashcard.where(user_id: user.id).delete_all
      SectionMarking.where(user_id: user.id).delete_all
      ReadingProgress.where(user_id: user.id).delete_all
      ChatThread.where(user_id: user.id).delete_all
      QuizSession.where(user_id: user.id).delete_all
      # Break the triangle's nullable legs (the task's own FKs are NOT NULL
      # and just dictate the delete order: tasks first, then materials and
      # nodes, plans last).
      Material.where(user_id: user.id).update_all(task_id: nil, node_id: nil)
      KnowledgeNode.where(user_id: user.id).update_all(task_id: nil)
      StudyTask.where(user_id: user.id).delete_all
      Material.where(user_id: user.id).delete_all
      KnowledgeNode.where(user_id: user.id).delete_all
      StudyPlan.where(user_id: user.id).delete_all
      original_sections = document["materials"].sole["sections"]

      # The downloaded JSON feeds the import mutation as the client would:
      # verbatim as the document variable (the input objects do the
      # camelCase → underscore normalization).
      fresh, fresh_token = user_with_token("wire-importer@example.com")
      result = graphql(
        <<~GRAPHQL, variables: { input: { document: document } }, token: fresh_token
          mutation Import($input: ImportDocumentInput!) {
            importDocument(input: $input) { imported skipped }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(error_code(result)).to be_nil
        expect(result.dig("data", "importDocument", "imported")).to eq(3)
        expect(result.dig("data", "importDocument", "skipped")).to eq(0)
        # Structural equality — the fresh user owns the same graph.
        expect(fresh.study_plans.count).to eq(1)
        expect(fresh.knowledge_nodes.count).to eq(1)
        expect(fresh.materials.count).to eq(1)
        expect(fresh.materials.sole.sections).to eq(original_sections)
      end
    end
  end

  describe "aiUsageToday" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql("query { aiUsageToday { callsToday dailyLimit } }")

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end

    it "reads the live counter (server truth) and the seam's limit" do
      user, token = user_with_token("counter@example.com")

      before = graphql("query { aiUsageToday { callsToday dailyLimit } }", token: token)
      Ai::DailyCap.consume!(user)
      Ai::DailyCap.consume!(user)
      after = graphql("query { aiUsageToday { callsToday dailyLimit } }", token: token)

      aggregate_failures do
        expect(error_code(before)).to be_nil
        expect(before.dig("data", "aiUsageToday", "callsToday")).to eq(0)
        expect(error_code(after)).to be_nil
        expect(after.dig("data", "aiUsageToday", "callsToday")).to eq(2)
        expect(after.dig("data", "aiUsageToday", "dailyLimit")).to eq(Ai::DailyCap.limit)
      end
    end

    it "reads the limit from the ENV seam at call time" do
      _, token = user_with_token("limit@example.com")

      original = ENV["AI_DAILY_CALL_CAP"]
      ENV["AI_DAILY_CALL_CAP"] = "7"
      result = graphql("query { aiUsageToday { callsToday dailyLimit } }", token: token)

      expect(result.dig("data", "aiUsageToday", "dailyLimit")).to eq(7)
    ensure
      original.nil? ? ENV.delete("AI_DAILY_CALL_CAP") : ENV["AI_DAILY_CALL_CAP"] = original
    end
  end

  private

  # A small linked document (plan → node → material, 3 rows) — enough to
  # prove the wire round trip without re-pinning the import spec's cascade.
  def settings_account_document
    @settings_account_document ||= {
      version: 1,
      onboarding_complete: true,
      plans: [ { id: "12111111-1111-4111-8111-111111111111", topic: "Settings plan",
                 goal: "Round trip", created_at: Time.zone.parse("2026-10-20T09:00:00Z") } ],
      nodes: [ { id: "12222222-2222-4222-8222-222222222222", title: "Wire node", stage: nil,
                 order: 0, plan_id: "12111111-1111-4111-8111-111111111111", task_id: nil,
                 created_at: Time.zone.parse("2026-10-20T09:00:00Z") } ],
      materials: [ { id: "12333333-3333-4333-8333-333333333333", title: "Settings doc.pdf",
                     kind: "pdf", size_bytes: 128,
                     plan_id: "12111111-1111-4111-8111-111111111111", task_id: nil,
                     parse_state: "parsed", parse_failure_reason: nil,
                     sections: [ { id: "page-1", title: "Page 1", text: "Wire text." } ],
                     created_at: Time.zone.parse("2026-10-20T09:00:00Z") } ],
      tasks: [], sessions: [], questions: [], evidence: [], flashcards: [], mistakes: [],
      reading_progress: [], chat_threads: [], section_markings: []
    }
  end
end
