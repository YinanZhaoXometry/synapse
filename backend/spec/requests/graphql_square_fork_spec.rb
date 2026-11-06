# frozen_string_literal: true

require "rails_helper"

# forkSquarePlan on the wire (epic P2-11 T3, FR-39/OQ-12): the AUTHENTICATED
# adopt mutation (delta decision 5 — adopting requires an account, unlike the
# T2 public reads). This file pins the wire behavior: the UNAUTHORIZED no-token
# posture (the standard guard, NOT the Square's public exception), the happy
# path returning the forked plan + its structure with the attribution field,
# the uniform NOT_FOUND matrix over the public scope, the empty-source and
# foreign-uuid refusals, and idempotent replay. The command underneath has its
# own direct spec (spec/commands/plans/fork_plan_command_spec.rb).
RSpec.describe "GraphQL forkSquarePlan (epic P2-11 T3)", type: :request do
  # A real row + a live token: the password matches the helper-pinned login
  # secret (token_for mints over a real HTTP login — GraphqlSpecHelpers).
  let(:adopter) { create(:user, password: password) }
  let(:token) { token_for(adopter.email) }

  def fork_mutation
    <<~GRAPHQL
      mutation($input: ForkSquarePlanInput!) {
        forkSquarePlan(input: $input) {
          plan {
            id
            topic
            goal
            visibility
            masteryScore
            forkedFromTopic
            nodes { title stage order }
          }
          nodes { id title stage order }
        }
      }
    GRAPHQL
  end

  def call_fork(source_id, client_uuid)
    graphql(
      fork_mutation,
      variables: { input: { sourcePlanId: source_id, clientUuid: client_uuid } },
      token: token
    )
  end

  describe "the auth posture (delta decision 5: authenticated, NOT the T2 public exception)" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql(
        fork_mutation,
        variables: { input: { sourcePlanId: SecureRandom.uuid, clientUuid: SecureRandom.uuid } }
      )

      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "the happy path" do
    it "forks a public plan's structure and returns it with the attribution field set" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: " react 19 路线", goal: "interview ready",
                                   visibility: "public")
      create(:knowledge_node, user: owner, plan: source, title: "fundamentals", stage: "基础", order: 0)
      create(:knowledge_node, user: owner, plan: source, title: "hooks deep dive", stage: "核心", order: 1)

      result = call_fork(source.id, SecureRandom.uuid)

      expect(result["errors"]).to be_nil
      payload = result.dig("data", "forkSquarePlan", "plan")
      expect(payload).to include(
        "topic" => " react 19 路线",
        "goal" => "interview ready",
        "visibility" => "private",
        "forkedFromTopic" => " react 19 路线",
        "masteryScore" => "0"
      )
      expect(payload["nodes"]).to eq([
        { "title" => "fundamentals", "stage" => "基础", "order" => 0 },
        { "title" => "hooks deep dive", "stage" => "核心", "order" => 1 }
      ])
      expect(result.dig("data", "forkSquarePlan", "nodes").length).to eq(2)

      # The fork is a NORMAL plan: it answers the caller's own authenticated
      # reads (the adopt flow hands the browser straight to it).
      detail = graphql("query($id: String!) { plan(id: $id) { id forkedFromTopic } }",
                       variables: { id: payload["id"] }, token: token)
      expect(detail.dig("data", "plan", "forkedFromTopic")).to eq(" react 19 路线")
    end

    it "lands in the caller's plans list (the 我要学 read-back the web sweep relies on)" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: "listable", visibility: "public")
      create(:knowledge_node, user: owner, plan: source, title: "n", order: 0)

      payload = call_fork(source.id, SecureRandom.uuid).dig("data", "forkSquarePlan", "plan")

      list = graphql("query { plans { id topic } }", token: token)
      expect(list.dig("data", "plans").map { |p| p["id"] }).to include(payload["id"])
    end

    it "carries the source's edges onto the forked plan, over the fork's own node ids (epic-16)" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: "edge-carrying", visibility: "public")
      first = create(:knowledge_node, user: owner, plan: source, title: "fundamentals", stage: "基础", order: 0)
      second = create(:knowledge_node, user: owner, plan: source, title: "hooks deep dive", stage: "核心", order: 1)
      create(:knowledge_node_edge, user: owner, plan: source, from_node: first, to_node: second)

      payload = call_fork(source.id, SecureRandom.uuid).dig("data", "forkSquarePlan", "plan")

      # Read the fork through the caller's own plan read: the edges' endpoints
      # are the fork's OWN nodes' uuids, in source position order.
      detail = graphql(
        "query($id: String!) { plan(id: $id) { nodes { id order } edges { fromNodeId toNodeId } } }",
        variables: { id: payload["id"] }, token: token
      )
      forked = detail.dig("data", "plan", "nodes").sort_by { |node| node["order"] }
      expect(detail.dig("data", "plan", "edges")).to eq([
        { "fromNodeId" => forked[0]["id"], "toNodeId" => forked[1]["id"] }
      ])
    end
  end

  describe "the refusal matrix" do
    it "answers uniform NOT_FOUND for private, unknown, and malformed source ids — no existence leak" do
      owner = create(:user)
      own = create(:study_plan, user: adopter, topic: "mine, hidden")

      shapes = [
        [ "own private", call_fork(own.id, SecureRandom.uuid) ],
        [ "unknown uuid", call_fork(SecureRandom.uuid, SecureRandom.uuid) ],
        [ "malformed", call_fork("../../etc/passwd", SecureRandom.uuid) ]
      ]

      shapes.each do |label, result|
        expect(result.dig("data", "forkSquarePlan")).to(be_nil, label)
        expect(error_code(result)).to(eq("NOT_FOUND"), label)
      end
    end

    it "refuses a zero-node public source with VALIDATION_FAILED (the pinned empty-shell ruling)" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: "空壳", visibility: "public")

      result = call_fork(source.id, SecureRandom.uuid)

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "refuses a non-uuid clientUuid with VALIDATION_FAILED" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: "t", visibility: "public")
      create(:knowledge_node, user: owner, plan: source, title: "n", order: 0)

      result = call_fork(source.id, "not-a-uuid")

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "refuses a clientUuid owned by another user with VALIDATION_FAILED (never silently link)" do
      owner = create(:user)
      stranger = create(:user)
      foreign = create(:study_plan, user: stranger)
      source = create(:study_plan, user: owner, topic: "t", visibility: "public")
      create(:knowledge_node, user: owner, plan: source, title: "n", order: 0)

      result = graphql(
        fork_mutation,
        variables: { input: { sourcePlanId: source.id, clientUuid: foreign.id } },
        token: token
      )

      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end
  end

  describe "idempotent replay (delta 3, on the wire)" do
    it "returns the same forked plan for a same-user clientUuid replay" do
      owner = create(:user)
      source = create(:study_plan, user: owner, topic: "replayable", visibility: "public")
      create(:knowledge_node, user: owner, plan: source, title: "n", order: 0)
      client_uuid = SecureRandom.uuid

      first = call_fork(source.id, client_uuid)
      replay = call_fork(source.id, client_uuid)

      expect(replay.dig("data", "forkSquarePlan", "plan", "id"))
        .to eq(first.dig("data", "forkSquarePlan", "plan", "id"))
      expect(adopter.study_plans.where(id: client_uuid).count).to eq(1)
    end
  end
end
