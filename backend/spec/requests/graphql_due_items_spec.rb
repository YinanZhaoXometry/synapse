# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL dueItems query (epic P2-7 ticket 03)", type: :request do
  # The wire behavior of the re-queue's Today-hub read (FR-24/FR-27): the
  # auth guard, the inclusive day window (overdue is still due), the FR-27
  # link shape, scoping, and the dead-source skip. The scan that
  # materializes the schedule has its own direct spec; the rake force-due
  # trigger is pinned by spec/lib/tasks/requeue_force_due_spec.rb.

  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "due-reader@example.com", password: password) }
  let(:token) { token_for(user.email) }

  def due_items_query(date: nil)
    call = date ? "dueItems(date: \"#{date}\")" : "dueItems"
    graphql(<<~GRAPHQL, token: token)
      query {
        #{call} {
          itemType itemId dueAt stage title
          nodeId planId taskId materialId questionId
          sourceLocation { kind page sectionId }
        }
      }
    GRAPHQL
  end

  it "answers UNAUTHORIZED without a token" do
    result = graphql("query { dueItems { itemType } }")

    expect(error_code(result)).to eq("UNAUTHORIZED")
  end

  it "answers the day's due items with the FR-27 link shape (mistake + flashcard)" do
    plan = create(:study_plan, user: user)
    node = create(:knowledge_node, user: user, plan_id: plan.id)
    question = create(:question, user: user, node: node, source_material: create(:material, user: user))
    create(:mistake_entry, user: user, question: question)
    card = create(:flashcard, user: user, material: create(:material, user: user, plan: node.plan))
    card.update!(difficulty: "hard")

    Requeue::ScanDueItemsCommand.call
    # Fresh items are due +1d (mistake) and +2d (hard card) — read the day
    # after tomorrow's end; the inclusive window answers everything due by
    # then (and exercises the date argument path).
    result = due_items_query(date: 3.days.from_now.iso8601)
    items = result.dig("data", "dueItems")

    aggregate_failures do
      expect(items.size).to eq(2)
      expect(items.map { |i| i["itemType"] }).to contain_exactly("mistake", "flashcard")
      mistake = items.find { |i| i["itemType"] == "mistake" }
      flashcard = items.find { |i| i["itemType"] == "flashcard" }
      expect(mistake["title"]).to eq(question.prompt)
      expect(mistake["nodeId"]).to eq(node.id)
      expect(mistake["planId"]).to eq(plan.id)
      expect(mistake["taskId"]).to be_nil # this node is plan-linked only
      expect(mistake["materialId"]).to eq(question.source_material_id)
      expect(mistake["questionId"]).to eq(question.id)
      expect(mistake["sourceLocation"]["kind"]).to eq("markdown")
      expect(flashcard["title"]).to eq(card.front)
      expect(flashcard["materialId"]).to eq(card.material_id)
      expect(flashcard["stage"]).to eq(0)
      expect(mistake["dueAt"]).to be_present
    end
  end

  it "keeps overdue items due (the window is inclusive — due by the day's END answers)" do
    travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
      card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
      Requeue::ScanDueItemsCommand.call
    end

    travel_to(Time.zone.parse("2026-11-10 09:00:00 UTC")) do
      result = due_items_query
      expect(result.dig("data", "dueItems").size).to eq(1)
    end
  end

  it "scopes to the caller (the outsider owns a due item; it must not appear)" do
    travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
      mine = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
      create(:user, email: "due-outsider@example.com", password: password)
      foreign_token = token_for("due-outsider@example.com")
      outsider_card = create(:flashcard, user: User.find_by!(email: "due-outsider@example.com"),
                                         difficulty: "hard", updated_at: Time.current)
      Requeue::ScanDueItemsCommand.call # materializes rows for BOTH users
      expect(RequeueSchedule.count).to eq(2)

      # Both cards are due +2d — read the window that includes them.
      result = graphql("query { dueItems(date: \"#{3.days.from_now.iso8601}\") { itemId } }",
                       token: foreign_token)

      ids = result.dig("data", "dueItems").pluck("itemId")
      aggregate_failures do
        expect(ids).to eq([ outsider_card.id ]) # the outsider sees only their own
        expect(ids).not_to include(mine.id)
      end
    end
  end

  it "skips a dead source (row deleted between scans) without failing the list" do
    travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
      card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
      Requeue::ScanDueItemsCommand.call
      card.destroy!
    end

    result = due_items_query

    expect(result.dig("data", "dueItems")).to eq([])
  end

  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }
end
