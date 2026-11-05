# frozen_string_literal: true

require "rails_helper"

# The hub read model on the wire (epic P2-09 T1, delta decision 4): the auth
# guard on every new query, the wire shapes, the two-user scoping proof, and
# the setWeeklyGoal setter (range refusal + persistence). The aggregation
# logic itself (week/day boundaries, badge thresholds, suggestion heuristic)
# is pinned at the Hubs seam (spec/lib/hubs_*) — these specs pin the wire
# projection of it.
RSpec.describe "GraphQL hub read model queries", type: :request do
  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "hub-reader@example.com", password: password) }
  let(:token) { token_for(user.email) }

  it "answers UNAUTHORIZED on every hub query and the setter without a token" do
    queries = <<~QUERIES.split("\n")
      mistakesHub { id }
      todayHub { due { itemId } }
      flashcardDecksHub { materialId }
      quizHistoryHub { sessionId }
      analyticsSeries { consistency { day } }
      weeklyGoal { target }
      badgeState { id }
    QUERIES
    aggregate_failures do
      queries.each do |query|
        result = graphql("query { #{query} }")
        expect(error_code(result)).to eq("UNAUTHORIZED")
      end

      result = graphql("mutation { setWeeklyGoal(input: { target: 3 }) { weeklyGoal { target } } }")
      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "mistakesHub" do
    it "answers the flat newest-first list with the deep-link shape" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      material = create(:material, user: user, plan_id: plan.id, kind: "pdf")
      session = create(:quiz_session, user: user, plan: plan)
      question = create(:question, user: user, session: session, node: node,
                                   source_material: material, source_section_id: "page-3",
                                   kind: "choice", options: [ "A", "B" ], correct_option_index: 1,
                                   prompt: "Which rule scopes every row?")
      create(:mistake_entry, user: user, question: question, session: session, node: node,
                             user_answer: "the frontend",
                             source_location: { "kind" => "pdf", "page" => 3 },
                             created_at: Time.zone.parse("2026-11-03 10:00:00 UTC"))

      result = graphql(<<~GRAPHQL, token: token)
        query {
          mistakesHub {
            id questionId sessionId nodeId planId taskId materialId
            userAnswer forfeited createdAt
            sourceLocation { kind page sectionId }
            question { prompt kind options correctOptionIndex sourceMaterialId sourceSectionId }
          }
        }
      GRAPHQL
      entries = result.dig("data", "mistakesHub")

      aggregate_failures do
        expect(entries.length).to eq(1)
        entry = entries.first
        expect(entry["questionId"]).to eq(question.id)
        expect(entry["sessionId"]).to eq(session.id)
        expect(entry["nodeId"]).to eq(node.id)
        expect(entry["planId"]).to eq(plan.id)
        expect(entry["taskId"]).to be_nil
        expect(entry["materialId"]).to eq(material.id)
        expect(entry["userAnswer"]).to eq("the frontend")
        expect(entry["forfeited"]).to be(false)
        expect(entry["sourceLocation"]).to eq("kind" => "pdf", "page" => 3, "sectionId" => nil)
        expect(entry["question"]["prompt"]).to eq("Which rule scopes every row?")
        expect(entry["question"]["sourceMaterialId"]).to eq(material.id)
        expect(entry["question"]["sourceSectionId"]).to eq("page-3")
      end
    end
  end

  describe "todayHub" do
    it "answers due + suggestions + manual + summary on one wire shape" do
      plan = create(:study_plan, user: user, topic: "Analytics plan")
      weak_node = create(:knowledge_node, user: user, plan_id: plan.id, order: 1, title: "Weak node")
      material = create(:material, user: user, plan_id: plan.id)
      question = create(:question, user: user, node: weak_node, source_material: material)
      create(:material_node_mapping, user: user, material: material, node: weak_node,
                                     section_id: "sec-1", status: "confirmed")
      create(:manual_task, user: user, title: "Summarize AD-13")

      travel_to(Time.zone.parse("2026-11-04 12:00:00 UTC")) do
        create(:mistake_entry, user: user, question: question, node: weak_node)
        create(:evidence_record, user: user, node: weak_node, outcome: "wrong",
                                 created_at: Time.current - 1.hour)
        Requeue::ScanDueItemsCommand.call
      end

      # the fresh mistake schedules due +1d — read from inside the inclusive
      # window (the same posture the dueItems spec uses; sequential travels,
      # never nested)
      travel_to(Time.zone.parse("2026-11-04 12:00:00 UTC") + 3.days) do
        result = graphql(<<~GRAPHQL, token: token)
          query {
            todayHub {
              due { itemType itemId title dueAt stage }
              suggestions { planId planTitle nodeId nodeTitle }
              manual { id title dueDate done createdAt }
              summary { dueCount manualCount doneCount }
            }
          }
        GRAPHQL
        hub = result.dig("data", "todayHub")

        aggregate_failures do
          expect(hub["due"]).to be_present
          expect(hub["due"].first["itemType"]).to eq("mistake")
          expect(hub["due"].first["title"]).to be_present
          expect(hub["suggestions"].length).to eq(1)
          suggestion = hub["suggestions"].first
          expect(suggestion["planId"]).to eq(plan.id)
          expect(suggestion["planTitle"]).to eq("Analytics plan")
          expect(suggestion["nodeId"]).to eq(weak_node.id)
          expect(suggestion["nodeTitle"]).to eq("Weak node")
          expect(hub["manual"].map { |t| t["title"] }).to eq([ "Summarize AD-13" ])
          expect(hub["manual"].first["done"]).to be(false)
          expect(hub["summary"]["manualCount"]).to eq(1)
          expect(hub["summary"]["doneCount"]).to eq(0)
        end
      end
    end
  end

  describe "flashcardDecksHub" do
    it "answers one row per material with counts and links" do
      plan = create(:study_plan, user: user, topic: "Deck plan")
      material = create(:material, user: user, plan_id: plan.id)
      create_list(:flashcard, 2, user: user, material: material)

      result = graphql(<<~GRAPHQL, token: token)
        query {
          flashcardDecksHub {
            materialId materialTitle planId planTitle taskId cardCount createdAt
          }
        }
      GRAPHQL
      decks = result.dig("data", "flashcardDecksHub")

      aggregate_failures do
        expect(decks.length).to eq(1)
        deck = decks.first
        expect(deck["materialId"]).to eq(material.id)
        expect(deck["materialTitle"]).to eq(material.title)
        expect(deck["planId"]).to eq(plan.id)
        expect(deck["planTitle"]).to eq("Deck plan")
        expect(deck["taskId"]).to be_nil
        expect(deck["cardCount"]).to eq(2)
        expect(deck["createdAt"]).to be_present
      end
    end
  end

  describe "quizHistoryHub" do
    it "answers sessions with the honest graded score summary" do
      plan = create(:study_plan, user: user, topic: "History plan")
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      material = create(:material, user: user, plan_id: plan.id)
      session = create(:quiz_session, user: user, plan: plan, mode: "mix",
                                      created_at: Time.zone.parse("2026-11-03 09:00:00 UTC"))
      q1 = create(:question, user: user, session: session, node: node, source_material: material)
      q2 = create(:question, user: user, session: session, node: node, source_material: material)
      create(:question, user: user, session: session, node: node, source_material: material) # unanswered
      create(:evidence_record, user: user, node: node, session: session, question: q1,
                               outcome: "correct", created_at: Time.zone.parse("2026-11-03 10:00:00 UTC"))
      create(:evidence_record, user: user, node: node, session: session, question: q2,
                               outcome: "wrong", created_at: Time.zone.parse("2026-11-03 11:00:00 UTC"))

      result = graphql(<<~GRAPHQL, token: token)
        query {
          quizHistoryHub {
            sessionId planId planTitle taskId mode createdAt questionCount
            scoreSummary { correct total }
          }
        }
      GRAPHQL
      history = result.dig("data", "quizHistoryHub")

      aggregate_failures do
        expect(history.length).to eq(1)
        entry = history.first
        expect(entry["sessionId"]).to eq(session.id)
        expect(entry["planId"]).to eq(plan.id)
        expect(entry["planTitle"]).to eq("History plan")
        expect(entry["taskId"]).to be_nil
        expect(entry["mode"]).to eq("mix")
        expect(entry["questionCount"]).to eq(3)
        expect(entry["scoreSummary"]).to eq("correct" => 1, "total" => 2)
      end
    end
  end

  describe "analyticsSeries" do
    it "answers the three series with the day-key wire conventions" do
      travel_to(Time.zone.parse("2026-11-04 12:00:00 UTC")) do
        plan = create(:study_plan, user: user, topic: "Series plan")
        node = create(:knowledge_node, user: user, plan_id: plan.id, title: "Series node")
        session = create(:quiz_session, user: user, plan: plan)
        [ 3, 2, 1 ].each do |hours_ago|
          create(:evidence_record, user: user, node: node, outcome: "correct",
                                   session: (session if hours_ago == 3),
                                   created_at: Time.current - hours_ago.hours)
        end
        result = graphql(<<~GRAPHQL, token: token)
          query {
            analyticsSeries {
              nodeMastery { nodeId nodeTitle planId masteryScore state }
              weeklyAccuracy { weekStart answered correct }
              consistency { day sessionCount }
            }
          }
        GRAPHQL
        series = result.dig("data", "analyticsSeries")

        aggregate_failures do
          mastery = series["nodeMastery"].first
          expect(mastery["nodeId"]).to eq(node.id)
          expect(mastery["nodeTitle"]).to eq("Series node")
          expect(mastery["planId"]).to eq(plan.id)
          expect(mastery["masteryScore"]).to eq("100") # the String convention (AD-6)
          expect(mastery["state"]).to eq("mastered")
          accuracy = series["weeklyAccuracy"]
          expect(accuracy.map { |p| p["weekStart"] }).to eq([ "2026-11-02" ])
          expect(accuracy.first["answered"]).to eq(3)
          expect(accuracy.first["correct"]).to eq(3)
          consistency = series["consistency"]
          expect(consistency.length).to eq(14)
          expect(consistency.last).to eq("day" => "2026-11-04", "sessionCount" => 1)
          expect(consistency.first["day"]).to eq("2026-10-22")
        end
      end
    end
  end

  describe "weeklyGoal" do
    it "answers target + current week sessions + week start" do
      result = graphql("query { weeklyGoal { target currentWeekSessions currentWeekStart } }",
                       token: token)

      goal = result.dig("data", "weeklyGoal")
      aggregate_failures do
        expect(goal["target"]).to eq(3) # the delta default
        expect(goal["currentWeekSessions"]).to eq(0)
        expect(goal["currentWeekStart"]).to be_present
      end
    end
  end

  describe "badgeState" do
    it "answers all 12 badges with counter/threshold" do
      result = graphql("query { badgeState { id unlocked counter threshold } }", token: token)
      badges = result.dig("data", "badgeState")

      aggregate_failures do
        expect(badges.map { |b| b["id"] }).to eq(%w[b1 b2 b3 b4 b5 b6 b7 b8 b9 b10 b11 b12])
        expect(badges.map { |b| b["unlocked"] }).to all(be(false))
        expect(badges.find { |b| b["id"] == "b4" }).to include("counter" => 0, "threshold" => 10)
        expect(badges.find { |b| b["id"] == "b10" }).to include("counter" => 0, "threshold" => 3)
      end
    end
  end

  describe "setWeeklyGoal" do
    it "persists the target and returns the fresh weekly goal" do
      result = graphql(<<~GRAPHQL, token: token)
        mutation { setWeeklyGoal(input: { target: 5 }) { weeklyGoal { target currentWeekSessions } } }
      GRAPHQL

      aggregate_failures do
        expect(user.reload.weekly_goal_target).to eq(5)
        expect(result.dig("data", "setWeeklyGoal", "weeklyGoal", "target")).to eq(5)
      end
    end

    it "refuses targets outside 1..21 with VALIDATION_FAILED, persisting nothing" do
      aggregate_failures do
        [ 0, 22 ].each do |target|
          result = graphql(
            "mutation { setWeeklyGoal(input: { target: #{target} }) { weeklyGoal { target } } }",
            token: token
          )
          expect(error_code(result)).to eq("VALIDATION_FAILED")
        end
      end
      expect(user.reload.weekly_goal_target).to eq(3) # untouched
    end
  end

  describe "two-user scoping (AD-13/FR-4) — one graph, two owners" do
    it "keeps the outsider's rows out of every aggregate" do
      outsider_token = nil
      travel_to(Time.zone.parse("2026-11-04 12:00:00 UTC")) do
        # my graph: one weak plan + one card + one manual task + one graded session
        plan = create(:study_plan, user: user, topic: "mine")
        node = create(:knowledge_node, user: user, plan_id: plan.id)
        create(:evidence_record, user: user, node: node, outcome: "wrong",
                                 created_at: Time.current - 1.hour)
        material = create(:material, user: user, plan_id: plan.id)
        create(:material_node_mapping, user: user, material: material, node: node,
                                       section_id: "sec-1", status: "confirmed")
        mine_card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
        create(:manual_task, user: user, title: "mine-task")
        my_session = create(:quiz_session, user: user, plan: plan)
        question = create(:question, user: user, session: my_session, node: node,
                                     source_material: material)
        create(:evidence_record, user: user, node: node, session: my_session, question: question,
                                 outcome: "wrong", created_at: Time.current)
        Requeue::ScanDueItemsCommand.call

        # the outsider builds the SAME-shaped graph
        create(:user, email: "hub-outsider@example.com", password: password)
        outsider_token = token_for("hub-outsider@example.com")
        outsider = User.find_by!(email: "hub-outsider@example.com")
        o_plan = create(:study_plan, user: outsider, topic: "outsider")
        o_node = create(:knowledge_node, user: outsider, plan_id: o_plan.id)
        create(:evidence_record, user: outsider, node: o_node, outcome: "correct",
                                 created_at: Time.current - 1.hour)
        o_material = create(:material, user: outsider, plan_id: o_plan.id)
        create(:material_node_mapping, user: outsider, material: o_material, node: o_node,
                                       section_id: "sec-1", status: "confirmed")
        create(:flashcard, user: outsider, difficulty: "hard", updated_at: Time.current)
        o_session = create(:quiz_session, user: outsider, plan: o_plan)
        o_question = create(:question, user: outsider, session: o_session, node: o_node,
                                       source_material: o_material)
        create(:evidence_record, user: outsider, node: o_node, session: o_session,
                                 question: o_question, outcome: "correct", created_at: Time.current)
        Requeue::ScanDueItemsCommand.call
        mine_card.reload # the scan advanced its stage

        result = graphql(<<~GRAPHQL, token: outsider_token)
          query {
            mistakesHub { questionId }
            todayHub { suggestions { planTitle } manual { title } summary { manualCount doneCount } }
            flashcardDecksHub { materialTitle }
            quizHistoryHub { sessionId }
            analyticsSeries { nodeMastery { nodeId masteryScore } weeklyAccuracy { answered } consistency { sessionCount } }
            weeklyGoal { currentWeekSessions }
            badgeState { id unlocked counter threshold }
          }
        GRAPHQL
        data = result.fetch("data")

        aggregate_failures do
          # everything the outsider sees is theirs
          expect(data["todayHub"]["suggestions"].pluck("planTitle")).to eq([ "outsider" ])
          expect(data["todayHub"]["manual"].pluck("title")).to eq([])
          expect(data["flashcardDecksHub"].pluck("materialTitle")).to eq([ o_material.title ])
          expect(data["quizHistoryHub"].pluck("sessionId")).to eq([ o_session.id ])
          expect(data["analyticsSeries"]["nodeMastery"].pluck("nodeId")).to eq([ o_node.id ])
          expect(data["analyticsSeries"]["weeklyAccuracy"].sum { |p| p["answered"] }).to eq(2)
          expect(data["weeklyGoal"]["currentWeekSessions"]).to eq(1)
          # my rows never leak into any aggregate — every unlocked counter is
          # THEIR OWN number (1 session, 1 card, 2 evidence records, streak 1)
          expect(data["mistakesHub"]).to eq([]) # outsider answered correctly — no mistakes
          badges = data["badgeState"]
          expect(badges.select { |b| b["unlocked"] }.pluck("id")).to eq(%w[b1])
          expect(badges.find { |b| b["id"] == "b4" }).to include("counter" => 1, "threshold" => 10)
          expect(badges.find { |b| b["id"] == "b5" }).to include("counter" => 2, "threshold" => 100)
          expect(badges.find { |b| b["id"] == "b2" }).to include("counter" => 1, "unlocked" => false)
        end

        # and my own read sees mine (symmetry spot-check on the same graph)
        mine = graphql("query { todayHub { suggestions { planTitle } manual { title } } }", token: token)
        mine_data = mine.fetch("data")["todayHub"]
        aggregate_failures do
          expect(mine_data["suggestions"].pluck("planTitle")).to eq([ "mine" ])
          expect(mine_data["manual"].pluck("title")).to eq([ "mine-task" ])
        end
      end
    end
  end

  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }
end
