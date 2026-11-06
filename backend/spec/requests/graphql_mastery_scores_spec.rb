# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL mastery scores + streak on the wire (epic P2-4 ticket 03)", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): factory evidence graphs answer the score fields, and every
  # expected value below is a hand-worked ADR-0001 example (the same math the
  # golden vectors pin on Mastery directly) — never a recomputation of the
  # code under test. The scoring engine has its own fixture-pinned specs
  # (spec/lib/mastery_spec.rb); this file pins the wire: fields exist, answer
  # through Mastery, move ONLY on evidence, and stay user-scoped (AD-13/14).
  #
  # The resolvers inject `now: Time.current` (the freshness cap is live on the
  # wire — ADR-0001 amendment 2026-11-04, ticket 04), so every describe reading
  # a score under the fixed Nov-2026 evidence corpus pins the clock with
  # travel_to (Rails 8 forbids nesting block travel_to, so the pin sits at the
  # describe level; the freshness examples travel to their own boundary
  # instants instead). Without a pin the fixed-timestamp evidence would age
  # past the 14-day window and the expectations would rot.

  describe "KnowledgeNodeType masteryScore + state (the plan detail's nodes)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

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

  describe "the score fields batch-load evidence (epic P2-4 review, finding P2-4)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

    it "answers a multi-node plan read with ONE evidence_records query, however many nodes it holds" do
      user, token = user_with_token("mastery-batched@example.com")
      plan = create(:study_plan, user: user)
      first = create(:knowledge_node, user: user, plan: plan, title: "first", order: 0)
      second = create(:knowledge_node, user: user, plan: plan, title: "second", order: 1)
      third = create(:knowledge_node, user: user, plan: plan, title: "third", order: 2)
      record_outcomes(first, %w[correct correct correct])
      record_outcomes(second, %w[correct correct])
      # third stays uncovered — the batch covers empty results too. Six score
      # field resolutions (2 fields × 3 nodes) ride one batched load.

      result = nil
      evidence_queries = count_loads_of(:evidence_record) do
        result = score_query(token, plan.id)
      end

      expect(evidence_queries).to eq(1)
      expect(result.dig("data", "plan", "nodes").map { |n| n["masteryScore"] }).to eq(%w[100 99 0])
    end
  end

  describe "StudyPlanType masteryScore (the plan rollup)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

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

  describe "freshness on the wire (ADR-0001 amendment 2026-11-04, ticket 04)" do
    # The golden-vector decay boundary: newest record 2026-11-05T10:00:00Z,
    # freshnessDays 14 → fresh through 2026-11-19T10:00:00Z, stale one second
    # later. Each example travels to its own boundary instant — Time.current
    # is what the resolvers inject into Mastery. Setup (login included) runs
    # INSIDE the travel block: the JWT exp is minted relative to now, so a
    # token minted at the real clock would be expired by the 15-day travel.
    def create_correct_on(node, year, month, day)
      create(:evidence_record, user: node.user, node: node, outcome: "correct",
                               created_at: Time.utc(year, month, day, 10, 0, 0))
    end

    it "certifies a node whose latest evidence is exactly 14 days old (\"100\" + mastered, the fresh boundary)" do
      travel_to(Time.utc(2026, 11, 19, 10, 0, 0)) do
        user, token = user_with_token("freshness-fresh@example.com")
        plan = create(:study_plan, user: user)
        node = create(:knowledge_node, user: user, plan: plan)
        create_correct_on(node, 2026, 11, 3)
        create_correct_on(node, 2026, 11, 4)
        create_correct_on(node, 2026, 11, 5)

        node_result = score_query(token, plan.id).dig("data", "plan", "nodes").first
        expect(node_result["masteryScore"]).to eq("100")
        expect(node_result["state"]).to eq("mastered")
      end
    end

    it "caps the same evidence one second past the window at \"99\" + partial (a stale score does not certify)" do
      travel_to(Time.utc(2026, 11, 19, 10, 0, 1)) do
        user, token = user_with_token("freshness-stale@example.com")
        plan = create(:study_plan, user: user)
        node = create(:knowledge_node, user: user, plan: plan)
        create_correct_on(node, 2026, 11, 3)
        create_correct_on(node, 2026, 11, 4)
        create_correct_on(node, 2026, 11, 5)

        node_result = score_query(token, plan.id).dig("data", "plan", "nodes").first
        expect(node_result["masteryScore"]).to eq("99")
        expect(node_result["state"]).to eq("partial")
      end
    end

    it "holds the plan rollup below 100 when one node has decayed (a decayed node can never certify)" do
      travel_to(Time.utc(2026, 11, 19, 10, 0, 1)) do
        user, token = user_with_token("freshness-rollup@example.com")
        plan = create(:study_plan, user: user)
        fresh = create(:knowledge_node, user: user, plan: plan, title: "fresh", order: 0)
        decayed = create(:knowledge_node, user: user, plan: plan, title: "decayed", order: 1)
        create_correct_on(fresh, 2026, 11, 10)
        create_correct_on(fresh, 2026, 11, 11)
        create_correct_on(fresh, 2026, 11, 12)
        create_correct_on(decayed, 2026, 10, 21)
        create_correct_on(decayed, 2026, 10, 22)
        create_correct_on(decayed, 2026, 10, 23)

        result = rollup_query(token, plan.id)

        # fresh node 7 days inside the window (100) + decayed node 27 days past it (99)
        # → floor((100 + 99) / 2) = 99 — without freshness the rollup would read 100
        # on a plan whose second node has not been touched for nearly a month.
        expect(result.dig("data", "plan", "masteryScore")).to eq("99")
        expect(result.dig("data", "plan", "nodes").map { |n| n["masteryScore"] }).to eq(%w[100 99])
      end
    end
  end

  describe "the streak query (user-scoped, UTC days)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

    it "reads 0 with no evidence at all" do
      _user, token = user_with_token("streak-empty@example.com")

      expect(graphql("query { streak }", token: token).dig("data", "streak")).to eq(0)
    end

    it "reads 1 when every record sits on one UTC day (same-day evidence does not multiply)" do
      user, token = user_with_token("streak-one-day@example.com")
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.utc(2026, 11, 4, 8, 0, 0))
      create(:evidence_record, user: user, node: node, outcome: "wrong",
                               created_at: Time.utc(2026, 11, 4, 11, 0, 0))

      expect(graphql("query { streak }", token: token).dig("data", "streak")).to eq(1)
    end

    it "reads 2 across yesterday→today, the boundary being UTC midnight (ADR-0001, amended 2026-11-04)" do
      user, token = user_with_token("streak-two-days@example.com")
      node = create(:knowledge_node, user: user)
      # Either side of UTC midnight alone proves the boundary is the UTC day,
      # not the container's local one.
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.utc(2026, 11, 3, 23, 59, 0))
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.utc(2026, 11, 4, 0, 1, 0))

      expect(graphql("query { streak }", token: token).dig("data", "streak")).to eq(2)
    end

    it "reads 0 when the latest evidence day is 2 days back (the streak is broken)" do
      user, token = user_with_token("streak-broken@example.com")
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.utc(2026, 11, 2, 10, 0, 0))

      expect(graphql("query { streak }", token: token).dig("data", "streak")).to eq(0)
    end
  end

  describe "a section claim never moves a score (FR-15, server-side)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

    it "leaves node, plan, and streak byte-identical across a claimSection write (a claim is never evidence)" do
      user, token = user_with_token("claim-never@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      create(:material, user: user, plan: plan)
      record_outcomes(node, %w[correct correct correct correct correct])
      before = mastery_snapshot(token, plan.id)

      claim = graphql(
        <<~GRAPHQL, token: token
          mutation {
            claimSection(input: { materialId: "#{user.materials.first.id}", sectionId: "sec-1" }) {
              sectionMarking { id sectionId }
            }
          }
        GRAPHQL
      )

      expect(claim.dig("data", "claimSection", "sectionMarking", "sectionId")).to eq("sec-1")
      expect(mastery_snapshot(token, plan.id)).to eq(before)
      expect(user.evidence_records.count).to eq(5)
    end
  end

  describe "cross-user scoping of the score-bearing reads (AD-13)" do
    around { |example| travel_to(Time.utc(2026, 11, 4, 12, 0, 0)) { example.run } }

    it "answers NOT_FOUND for a foreign plan id even with score fields selected (uniform NOT_FOUND, delta 2)" do
      owner, _owner_token = user_with_token("score-owner@example.com")
      _attacker, attacker_token = user_with_token("score-attacker@example.com")
      plan = create(:study_plan, user: owner)
      node = create(:knowledge_node, user: owner, plan: plan)
      record_outcomes(node, %w[correct correct correct])

      result = rollup_query(attacker_token, plan.id)

      expect(result.dig("data", "plan")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
    end
  end

  private

  # Everything the FR-15 pin compares: the node's score + state, the plan
  # rollup, the streak — one hash, one deep equality.
  def mastery_snapshot(token, plan_id)
    {
      node: score_query(token, plan_id).dig("data", "plan", "nodes", 0).slice("masteryScore", "state"),
      plan_rollup: rollup_query(token, plan_id).dig("data", "plan", "masteryScore"),
      streak: graphql("query { streak }", token: token).dig("data", "streak")
    }
  end

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
