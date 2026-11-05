# frozen_string_literal: true

require "rails_helper"

# The Square public read path on the wire (epic P2-11 T2, FR-39 — the AD-13
# exception): squarePlans/squarePlan are unauthenticated-readable by design,
# resolve through the explicit StudyPlan.publicly_visible scope (never the
# caller's association chain — there IS no caller on this path), and answer
# only the reduced SquarePlanType structure set. The type-level leak-proof
# AC lives in spec/graphql/square_public_types_spec.rb; this file pins the
# wire behavior: the no-token posture, public-only listing (newest-first,
# delta decision 2), uniform NOT_FOUND-shaped absence (no existence leak),
# immediate flip propagation (cross-linked to T1's setPlanVisibility), the
# two-user graph, bounded reads (no N+1), and forbidden selections failing
# validation.
RSpec.describe "GraphQL Square public read path (epic P2-11 T2)", type: :request do
  describe "the AD-13 exception posture (no current_user required)" do
    it "answers squarePlans without a token" do
      create(:study_plan, visibility: "public", topic: "open plan")

      result = graphql("query { squarePlans { id topic } }")

      expect(result["errors"]).to be_nil
      expect(result.dig("data", "squarePlans").map { |p| p["topic"] }).to eq([ "open plan" ])
    end

    it "answers squarePlans even under a garbage token — the public path never consults identity" do
      create(:study_plan, visibility: "public")

      anonymous = graphql("query { squarePlans { id } }")
      garbage = graphql("query { squarePlans { id } }", token: "not-a-real-token")

      expect(garbage).to eq(anonymous)
      expect(garbage.dig("data", "squarePlans").length).to eq(1)
    end

    it "answers squarePlan without a token" do
      plan = create(:study_plan, visibility: "public", topic: "previewable")

      result = graphql("query($id: String!) { squarePlan(id: $id) { topic } }",
                       variables: { id: plan.id })

      expect(result["errors"]).to be_nil
      expect(result.dig("data", "squarePlan", "topic")).to eq("previewable")
    end
  end

  describe "squarePlans listing (delta decision 2: newest-first, no pagination v1)" do
    it "lists every owner's public plans newest-first and excludes every private plan" do
      owner, _token = user_with_token("square-owner@example.com")
      other = create(:user)
      old_public = create(:study_plan, user: owner, topic: "older public",
                                       visibility: "public", created_at: Time.current - 1.hour)
      _own_private = create(:study_plan, user: owner, topic: "kept private")
      new_public = create(:study_plan, user: other, topic: "newer public", visibility: "public")
      _other_private = create(:study_plan, user: other, topic: "stranger private")

      result = graphql("query { squarePlans { id topic visibility } }")

      plans = result.dig("data", "squarePlans")
      expect(plans.map { |p| p["id"] }).to eq([ new_public.id, old_public.id ])
      expect(plans.map { |p| p["visibility"] }).to eq([ "public", "public" ])
    end

    it "returns an empty list when nothing is public" do
      create(:study_plan) # private by default

      result = graphql("query { squarePlans { id } }")

      expect(result.dig("data", "squarePlans")).to eq([])
    end
  end

  describe "squarePlan preview (structure only)" do
    it "returns the reduced structure with stage-ordered node summaries, without a token" do
      owner = create(:user)
      plan = create(:study_plan, user: owner, topic: "public roadmap", visibility: "public")
      create(:knowledge_node, user: owner, plan: plan, title: "应用 capstone", stage: "应用", order: 7)
      create(:knowledge_node, user: owner, plan: plan, title: "基础 first", stage: "基础", order: 2)
      create(:knowledge_node, user: owner, plan: plan, title: "核心 second", stage: "核心", order: 4)

      result = graphql(<<~GRAPHQL, variables: { id: plan.id })
        query($id: String!) {
          squarePlan(id: $id) {
            id topic goal visibility createdAt
            nodeSummaries { title stage order }
          }
        }
      GRAPHQL

      payload = result.dig("data", "squarePlan")
      expect(payload).to eq(
        "id" => plan.id,
        "topic" => "public roadmap",
        "goal" => nil,
        "visibility" => "public",
        "createdAt" => payload["createdAt"],
        "nodeSummaries" => [
          { "title" => "基础 first", "stage" => "基础", "order" => 2 },
          { "title" => "核心 second", "stage" => "核心", "order" => 4 },
          { "title" => "应用 capstone", "stage" => "应用", "order" => 7 }
        ]
      )
      expect(payload["createdAt"]).to be_present
    end

    it "carries a non-null goal when the plan declares one" do
      owner = create(:user)
      plan = create(:study_plan, user: owner, goal: "pass the exam", visibility: "public")

      result = graphql("query($id: String!) { squarePlan(id: $id) { goal } }",
                       variables: { id: plan.id })

      expect(result.dig("data", "squarePlan", "goal")).to eq("pass the exam")
    end

    it "rejects content-field selections as invalid (nothing to select — the wire half of leak-proofing)" do
      owner = create(:user)
      plan = create(:study_plan, user: owner, visibility: "public")
      create(:knowledge_node, user: owner, plan: plan, title: "n", order: 0)

      plan_leak = graphql("query($id: String!) { squarePlan(id: $id) { id masteryScore materials { id } } }",
                          variables: { id: plan.id })
      node_leak = graphql("query($id: String!) { squarePlan(id: $id) { nodeSummaries { title state } } }",
                          variables: { id: plan.id })

      expect(plan_leak["data"]).to be_nil
      expect(plan_leak["errors"]).to be_present
      expect(node_leak["data"]).to be_nil
      expect(node_leak["errors"]).to be_present
    end
  end

  describe "private-plan absence (no existence leak)" do
    it "answers uniform NOT_FOUND-shaped absence for private, foreign, unknown, and malformed ids" do
      owner, owner_token = user_with_token("absence-owner@example.com")
      stranger = create(:user)
      own_private = create(:study_plan, user: owner, topic: "mine, hidden")
      foreign_private = create(:study_plan, user: stranger, topic: "theirs, hidden")

      shapes = [
        [ "own private plan", graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                      variables: { id: own_private.id }) ],
        [ "foreign private plan", graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                          variables: { id: foreign_private.id }) ],
        [ "unknown uuid", graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                  variables: { id: SecureRandom.uuid }) ],
        [ "malformed id", graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                  variables: { id: "../../etc/passwd" }) ]
      ]

      shapes.each do |label, result|
        expect(result.dig("data", "squarePlan")).to(be_nil, label)
        expect(error_code(result)).to(eq("NOT_FOUND"), label)
      end
      # All four flavors are byte-identical on the wire — asking about a
      # private plan is indistinguishable from asking about nothing.
      expect(shapes.map { |_, result| result }).to all(eq(shapes.first[1]))

      # The square door never consults identity: even the OWNER — bearing a
      # valid token for their own private plan — gets the same absence.
      own_with_token = graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                               variables: { id: own_private.id }, token: owner_token)
      expect(own_with_token).to eq(shapes.first[1])
    end

    it "excludes private plans from the listing for every caller (two-user graph)" do
      user_a, token_a = user_with_token("graph-a@example.com")
      user_b, token_b = user_with_token("graph-b@example.com")
      plan_b = create(:study_plan, user: user_b, topic: "b private")

      # B sees their own plan through the AUTHENTICATED door...
      expect(graphql("query($id: String!) { plan(id: $id) { id } }",
                     variables: { id: plan_b.id }, token: token_b)
        .dig("data", "plan", "id")).to eq(plan_b.id)
      # ...and A still cannot (the authenticated door stays user-scoped).
      expect(error_code(graphql("query($id: String!) { plan(id: $id) { id } }",
                                variables: { id: plan_b.id }, token: token_a))).to eq("NOT_FOUND")
      # But the PUBLIC door hides it from everyone — B included.
      expect(graphql("query { squarePlans { id } }").dig("data", "squarePlans")).to eq([])
      expect(graphql("query { squarePlans { id } }", token: token_b).dig("data", "squarePlans")).to eq([])
      expect(error_code(graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                variables: { id: plan_b.id }, token: token_b))).to eq("NOT_FOUND")
      expect(error_code(graphql("query($id: String!) { squarePlan(id: $id) { id } }",
                                variables: { id: plan_b.id }, token: token_a))).to eq("NOT_FOUND")
    end
  end

  describe "visibility flip propagation (cross-linked to T1's setPlanVisibility)" do
    it "appears after the flip to public and vanishes after the flip back — immediately, for anonymous callers" do
      user, token = user_with_token("flipper@example.com")
      plan = create(:study_plan, user: user, topic: "flip target")
      list = "query { squarePlans { id } }"
      by_id = "query($id: String!) { squarePlan(id: $id) { id nodeSummaries { title } } }"

      # Private: absent both ways.
      expect(graphql(list).dig("data", "squarePlans")).to eq([])
      expect(error_code(graphql(by_id, variables: { id: plan.id }))).to eq("NOT_FOUND")

      # Flip to public (T1's authenticated mutation)…
      flipped = graphql(
        "mutation($input: SetPlanVisibilityInput!) { setPlanVisibility(input: $input) { plan { id visibility } } }",
        variables: { input: { planId: plan.id, visibility: "public" } },
        token: token
      )
      expect(flipped.dig("data", "setPlanVisibility", "plan", "visibility")).to eq("public")

      # …and the anonymous wire sees it immediately (query-truth: no server cache).
      expect(graphql(list).dig("data", "squarePlans").map { |p| p["id"] }).to eq([ plan.id ])
      expect(graphql(by_id, variables: { id: plan.id }).dig("data", "squarePlan", "id")).to eq(plan.id)

      # Flip back: gone again, immediately.
      graphql(
        "mutation($input: SetPlanVisibilityInput!) { setPlanVisibility(input: $input) { plan { id visibility } } }",
        variables: { input: { planId: plan.id, visibility: "private" } },
        token: token
      )
      expect(graphql(list).dig("data", "squarePlans")).to eq([])
      expect(error_code(graphql(by_id, variables: { id: plan.id }))).to eq("NOT_FOUND")
    end
  end

  describe "bounded reads (no N+1 on node summaries)" do
    # Count SELECT statements the one squarePlans execution issues, with a
    # warm-up first so schema-cache chatter cannot leak into the measurement.
    def selects_for(query)
      graphql(query) # warm-up
      selects = 0
      subscription = ActiveSupport::Notifications.subscribe("sql.active_record") do |*args|
        payload = args.last
        selects += 1 if payload[:sql].to_s.strip.upcase.start_with?("SELECT")
      end
      graphql(query)
      selects
    ensure
      ActiveSupport::Notifications.unsubscribe(subscription)
    end

    it "keeps the node-summaries load at a fixed query count as the plan count grows" do
      owner = create(:user)
      solo = create(:study_plan, user: owner, visibility: "public")
      4.times { |i| create(:knowledge_node, user: owner, plan: solo, title: "n#{i}", order: i) }
      query = "query { squarePlans { id nodeSummaries { title stage order } } }"

      solo_count = selects_for(query)

      4.times do |p|
        extra = create(:study_plan, user: owner, topic: "plan #{p}", visibility: "public")
        4.times { |i| create(:knowledge_node, user: owner, plan: extra, title: "n#{p}-#{i}", order: i) }
      end

      five_count = selects_for(query)

      # 1 for the public plans + 1 preloaded node pass — never one per plan.
      expect(solo_count).to be <= 3
      expect(five_count).to eq(solo_count)
    end
  end
end
