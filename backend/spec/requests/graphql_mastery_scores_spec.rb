# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL mastery scores + streak on the wire (epic P2-4 ticket 03)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): factory evidence graphs answer the score fields, and every
  # expected value below is a hand-worked ADR-0001 example (the same math the
  # golden vectors pin on Mastery directly) — never a recomputation of the
  # code under test. The scoring engine has its own fixture-pinned specs
  # (spec/lib/mastery_spec.rb); this file pins the wire: fields exist, answer
  # through Mastery, move ONLY on evidence, and stay user-scoped (AD-13/14).

  describe "KnowledgeNodeType masteryScore + state (the plan detail's nodes)" do
    it "reads an uncovered node as \"0\" + uncovered (no evidence ever reads green)" do
      user, token = user_with_token("mastery-uncovered@example.com")
      plan = create(:study_plan, user: user)
      create(:knowledge_node, user: user, plan: plan, title: "scopes", order: 0)

      result = graphql(
        "query($id: String!) { plan(id: $id) { nodes { title masteryScore state } } }",
        variables: { id: plan.id },
        token: token
      )

      node = result.dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("0")
      expect(node["state"]).to eq("uncovered")
    end

    it "reads five correct answers as \"100\" + mastered (the full-window sweep)" do
      user, token = user_with_token("mastery-sweep@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      record_outcomes(node, %w[correct correct correct correct correct])

      result = score_query(token, plan.id)

      node = result.dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("100")
      expect(node["state"]).to eq("mastered")
    end

    it "reads four correct + one wrong as \"80\" + mastered (the threshold edge)" do
      user, token = user_with_token("mastery-threshold@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      record_outcomes(node, %w[correct correct correct correct wrong])

      node = score_query(token, plan.id).dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("80")
      expect(node["state"]).to eq("mastered")
    end

    it "caps two correct answers at \"99\" + partial (below the evidence gate the score caps, ADR-0001)" do
      user, token = user_with_token("mastery-gate@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      record_outcomes(node, %w[correct correct])

      node = score_query(token, plan.id).dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("99")
      expect(node["state"]).to eq("partial")
    end

    it "rounds correct+correct+partial to \"83\" + mastered (the golden vectors' 83.33…→83 pin)" do
      user, token = user_with_token("mastery-rounding@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      record_outcomes(node, %w[correct correct partial])

      node = score_query(token, plan.id).dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("83")
      expect(node["state"]).to eq("mastered")
    end

    it "windows over the last five by recency: a stale wrong answer outside the window is forgotten" do
      user, token = user_with_token("mastery-window@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      # The wrong answer is the OLDEST record (created first, minute 0); the
      # window keeps the five newer corrects → mean 1.0 → 100.
      record_outcomes(node, %w[wrong correct correct correct correct correct])

      node = score_query(token, plan.id).dig("data", "plan", "nodes").first
      expect(node["masteryScore"]).to eq("100")
      expect(node["state"]).to eq("mastered")
    end

    it "answers a Study Task's owned node through the same fields (the task rollup IS its node's score)" do
      user, token = user_with_token("mastery-task@example.com")
      task = create(:study_task, user: user)
      record_outcomes(task.node, %w[correct correct correct])

      result = graphql(
        "query($id: String!) { task(id: $id) { node { masteryScore state } } }",
        variables: { id: task.id },
        token: token
      )

      node = result.dig("data", "task", "node")
      expect(node["masteryScore"]).to eq("100")
      expect(node["state"]).to eq("mastered")
    end
  end

  describe "StudyPlanType masteryScore (the plan rollup)" do
    it "reads \"0\" for a plan whose nodes hold no evidence" do
      user, token = user_with_token("rollup-zero@example.com")
      plan = create(:study_plan, user: user)
      create(:knowledge_node, user: user, plan: plan)
      create(:knowledge_node, user: user, plan: plan, title: "second node", order: 1)

      result = rollup_query(token, plan.id)

      expect(result.dig("data", "plan", "masteryScore")).to eq("0")
    end

    it "rolls up mixed nodes floored: 100 + 99 + uncovered 0 → \"66\" (uncovered counts zero, AD-6)" do
      user, token = user_with_token("rollup-mixed@example.com")
      plan = create(:study_plan, user: user)
      mastered = create(:knowledge_node, user: user, plan: plan, title: "mastered", order: 0)
      gated = create(:knowledge_node, user: user, plan: plan, title: "gated", order: 1)
      create(:knowledge_node, user: user, plan: plan, title: "uncovered", order: 2)
      record_outcomes(mastered, %w[correct correct correct correct correct]) # → 100
      record_outcomes(gated, %w[correct correct]) # → 99 (below the evidence gate)

      result = rollup_query(token, plan.id)

      # floor((100 + 99 + 0) / 3) = floor(66.33…) = 66.
      expect(result.dig("data", "plan", "masteryScore")).to eq("66")
    end

    it "floors the 100+99 tie to \"99\" (rollup 100 ⇔ every node mastered, ADR-0001 amendment 2026-11-04)" do
      user, token = user_with_token("rollup-tie@example.com")
      plan = create(:study_plan, user: user)
      full = create(:knowledge_node, user: user, plan: plan, title: "full", order: 0)
      capped = create(:knowledge_node, user: user, plan: plan, title: "capped", order: 1)
      record_outcomes(full, %w[correct correct correct correct correct]) # → 100
      record_outcomes(capped, %w[correct correct]) # → 99

      result = rollup_query(token, plan.id)

      # floor((100 + 99) / 2) = floor(99.5) = 99 — half-up would have read 100
      # on an unverified node; the golden vectors pin this exact tie.
      expect(result.dig("data", "plan", "masteryScore")).to eq("99")
    end
  end

  private

  # The rollup read (the plan's own masteryScore).
  def rollup_query(token, plan_id)
    graphql(
      "query($id: String!) { plan(id: $id) { masteryScore nodes { masteryScore } } }",
      variables: { id: plan_id },
      token: token
    )
  end

  # The score-bearing plan detail read the node specs share.
  def score_query(token, plan_id)
    graphql(
      "query($id: String!) { plan(id: $id) { nodes { id masteryScore state } } }",
      variables: { id: plan_id },
      token: token
    )
  end

  # One EvidenceRecord per outcome, a minute apart in a fixed UTC hour —
  # recency (the window's sort key) stays deterministic without time travel.
  def record_outcomes(node, outcomes)
    outcomes.each_with_index do |outcome, i|
      create(:evidence_record, user: node.user, node: node, outcome: outcome,
                               created_at: Time.utc(2026, 11, 1, 9, i, 0))
    end
  end
end
