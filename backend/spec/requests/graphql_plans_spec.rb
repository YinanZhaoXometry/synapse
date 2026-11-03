# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL plans + nodes operations (epic P2-3 ticket 01)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The commands underneath
  # have their own direct specs (spec/commands/plans/); this file pins the
  # wire behavior.

  describe "the auth guard on every plan operation (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token on all six operations" do
      queries = [
        "query { plans { id } }",
        'query { plan(id: "00000000-0000-0000-0000-000000000000") { id } }'
      ]
      mutations = [
        "mutation { createPlan(input: { clientUuid: \"#{SecureRandom.uuid}\", topic: \"t\", " \
          "nodes: [{ title: \"n\" }] }) { plan { id } } }",
        "mutation { confirmProposal(input: { clientUuid: \"#{SecureRandom.uuid}\", topic: \"t\", " \
          "stages: [{ name: \"s\", nodeTitles: [\"n\"] }] }) { plan { id } } }",
        "mutation { updatePlan(input: { id: \"#{SecureRandom.uuid}\", topic: \"t\" }) { plan { id } } }",
        "mutation { deletePlan(input: { id: \"#{SecureRandom.uuid}\" }) { deletedPlanId } }"
      ]

      queries.each do |query|
        expect(error_code(graphql(query))).to eq("UNAUTHORIZED")
      end
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "plans query (the current user's plain list)" do
    it "lists only the caller's plans, with a real second user proving the scope" do
      user, token = user_with_token("list-owner@example.com")
      own = [
        create(:study_plan, user: user),
        create(:study_plan, user: user, topic: "second plan")
      ]
      other = create(:user)
      create(:study_plan, user: other)

      result = graphql("query { plans { id topic visibility createdAt } }", token: token)

      plans = result.dig("data", "plans")
      expect(plans.map { |p| p["id"] }).to match_array(own.map(&:id))
      expect(plans.first["visibility"]).to eq("private")
      expect(plans.first["createdAt"]).to be_present
    end
  end

  describe "plan query (detail with the node tree)" do
    it "returns the plan with its nodes ordered by order (the listNodesByPlan mirror)" do
      user, token = user_with_token("detail@example.com")
      plan = create(:study_plan, user: user, topic: "detail topic", goal: "detail goal")
      create(:knowledge_node, user: user, plan: plan, title: "second", stage: "核心", order: 1)
      create(:knowledge_node, user: user, plan: plan, title: "first", stage: "基础", order: 0)

      result = graphql(
        <<~GRAPHQL, variables: { id: plan.id }, token: token
          query PlanDetail($id: String!) {
            plan(id: $id) {
              id topic goal visibility createdAt
              nodes { id planId taskId stage title order createdAt }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "plan")
      expect(payload["id"]).to eq(plan.id)
      expect(payload["topic"]).to eq("detail topic")
      expect(payload["goal"]).to eq("detail goal")
      expect(payload["visibility"]).to eq("private")
      expect(payload["createdAt"]).to be_present
      expect(payload["nodes"].map { |n| n["title"] }).to eq([ "first", "second" ])
      expect(payload["nodes"].map { |n| n["order"] }).to eq([ 0, 1 ])
      expect(payload["nodes"].map { |n| n["stage"] }).to eq([ "基础", "核心" ])
      expect(payload["nodes"].first["planId"]).to eq(plan.id)
      expect(payload["nodes"].first["taskId"]).to be_nil
      expect(payload["nodes"].first["id"]).to be_a_uuid
    end

    it "answers NOT_FOUND for another user's plan id (uniform NOT_FOUND, delta 2)" do
      _owner, token = user_with_token("not-owner@example.com")
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)

      result = graphql(
        "query($id: String!) { plan(id: $id) { id } }",
        variables: { id: foreign_plan.id },
        token: token
      )

      expect(result.dig("data", "plan")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
    end

    it "answers NOT_FOUND for an unknown plan id" do
      _user, token = user_with_token("unknown-plan@example.com")

      result = graphql(
        "query($id: String!) { plan(id: $id) { id } }",
        variables: { id: SecureRandom.uuid },
        token: token
      )

      expect(error_code(result)).to eq("NOT_FOUND")
    end
  end

  describe "createPlan mutation" do
    it "creates the plan + nodes in one call and honors the client uuid" do
      user, token = user_with_token("creator@example.com")
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: input_for(client_uuid) }, token: token
          mutation CreatePlan($input: CreatePlanInput!) {
            createPlan(input: $input) {
              plan { id topic goal visibility nodes { title stage order } }
              nodes { id title stage order }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "createPlan")
      expect(payload["plan"]["id"]).to eq(client_uuid)
      expect(payload["plan"]["topic"]).to eq("graphQL epic")
      expect(payload["plan"]["goal"]).to eq("ship it")
      expect(payload["plan"]["visibility"]).to eq("private")
      expect(payload["plan"]["nodes"].map { |n| n["order"] }).to eq([ 0, 1 ])

      plan = user.study_plans.find(client_uuid)
      expect(plan.knowledge_nodes.order(:order).map(&:title)).to eq([ "commands", "scoping" ])
      expect(plan.knowledge_nodes.order(:order).map(&:stage)).to eq([ "基础", nil ])
    end

    it "is idempotent on replay with the same client uuid (same row, no duplicates)" do
      _user, token = user_with_token("replayer@example.com")
      client_uuid = SecureRandom.uuid
      first = graphql(
        <<~GRAPHQL, variables: { input: input_for(client_uuid) }, token: token
          mutation CreatePlan($input: CreatePlanInput!) {
            createPlan(input: $input) { plan { id } nodes { id } }
          }
        GRAPHQL
      )

      replay = graphql(
        <<~GRAPHQL, variables: { input: input_for(client_uuid) }, token: token
          mutation CreatePlan($input: CreatePlanInput!) {
            createPlan(input: $input) { plan { id } nodes { id } }
          }
        GRAPHQL
      )

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "createPlan", "plan", "id")).to eq(client_uuid)
      expect(replay.dig("data", "createPlan", "nodes").map { |n| n["id"] })
        .to match_array(first.dig("data", "createPlan", "nodes").map { |n| n["id"] })
      expect(User.find_by!(email: "replayer@example.com").study_plans.count).to eq(1)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (delta 3)" do
      owner, _token = user_with_token("uuid-owner@example.com")
      other, other_token = user_with_token("uuid-collider@example.com")
      owned = create(:study_plan, user: owner)

      result = graphql(
        <<~GRAPHQL, variables: { input: input_for(owned.id) }, token: other_token
          mutation CreatePlan($input: CreatePlanInput!) {
            createPlan(input: $input) { plan { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "createPlan")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(other.study_plans.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank topic (typed failure path)" do
      _user, token = user_with_token("blank-topic@example.com")

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            createPlan(input: { clientUuid: "#{SecureRandom.uuid}", topic: "   ",
                                nodes: [{ title: "n" }] }) { plan { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "createPlan")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end
  end

  describe "confirmProposal mutation" do
    it "confirms a stage-grouped proposal into plan + nodes in one call" do
      user, token = user_with_token("confirmer@example.com")
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: proposal_input(client_uuid) }, token: token
          mutation ConfirmProposal($input: ConfirmProposalInput!) {
            confirmProposal(input: $input) {
              plan { id topic nodes { title stage order } }
              nodes { id title stage order }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "confirmProposal")
      expect(payload["plan"]["id"]).to eq(client_uuid)
      expect(payload["plan"]["nodes"].map { |n| n["title"] })
        .to eq([ "graphql basics", "commands", "scoping" ])
      expect(payload["plan"]["nodes"].map { |n| n["stage"] }).to eq([ "基础", "基础", "核心" ])
      expect(payload["plan"]["nodes"].map { |n| n["order"] }).to eq([ 0, 1, 2 ])
      expect(user.knowledge_nodes.where(plan_id: client_uuid).count).to eq(3)
    end

    it "is idempotent on replay with the same client uuid" do
      _user, token = user_with_token("proposal-replayer@example.com")
      client_uuid = SecureRandom.uuid
      graphql(<<~GRAPHQL, variables: { input: proposal_input(client_uuid) }, token: token)
        mutation ConfirmProposal($input: ConfirmProposalInput!) {
          confirmProposal(input: $input) { plan { id } }
        }
      GRAPHQL

      replay = graphql(<<~GRAPHQL, variables: { input: proposal_input(client_uuid) }, token: token)
        mutation ConfirmProposal($input: ConfirmProposalInput!) {
          confirmProposal(input: $input) { plan { id } nodes { id } }
        }
      GRAPHQL

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "confirmProposal", "plan", "id")).to eq(client_uuid)
      expect(replay.dig("data", "confirmProposal", "nodes").length).to eq(3)
      expect(User.find_by!(email: "proposal-replayer@example.com").knowledge_nodes
        .where(plan_id: client_uuid).count).to eq(3)
    end
  end

  describe "updatePlan mutation" do
    it "applies the patch; an explicit null goal clears it" do
      user, token = user_with_token("updater@example.com")
      plan = create(:study_plan, user: user, topic: "old", goal: "old goal")

      result = graphql(
        <<~GRAPHQL, variables: { input: { id: plan.id, topic: "new topic", goal: nil } }, token: token
          mutation UpdatePlan($input: UpdatePlanInput!) {
            updatePlan(input: $input) { plan { id topic goal visibility } }
          }
        GRAPHQL
      )

      payload = result.dig("data", "updatePlan", "plan")
      expect(payload["topic"]).to eq("new topic")
      expect(payload["goal"]).to be_nil
      expect(plan.reload.goal).to be_nil
    end

    it "leaves absent fields untouched" do
      user, token = user_with_token("absent-fields@example.com")
      plan = create(:study_plan, user: user, topic: "keep me", goal: "keep goal")

      result = graphql(
        <<~GRAPHQL, variables: { input: { id: plan.id, topic: "changed" } }, token: token
          mutation UpdatePlan($input: UpdatePlanInput!) {
            updatePlan(input: $input) { plan { id topic goal } }
          }
        GRAPHQL
      )

      payload = result.dig("data", "updatePlan", "plan")
      expect(payload["topic"]).to eq("changed")
      expect(payload["goal"]).to eq("keep goal")
    end

    it "answers NOT_FOUND for another user's plan id (via real second user + JWT)" do
      owner, _owner_token = user_with_token("update-owner@example.com")
      _attacker, attacker_token = user_with_token("update-attacker@example.com")
      plan = create(:study_plan, user: owner, topic: "not yours")

      result = graphql(
        <<~GRAPHQL, variables: { input: { id: plan.id, topic: "hijacked" } }, token: attacker_token
          mutation UpdatePlan($input: UpdatePlanInput!) {
            updatePlan(input: $input) { plan { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "updatePlan")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(plan.reload.topic).to eq("not yours")
    end
  end

  describe "deletePlan mutation" do
    it "deletes the plan with its nodes and attached rows" do
      user, token = user_with_token("deleter@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan)
      progress = create(:reading_progress, user: user, material: material)

      result = graphql(
        <<~GRAPHQL, variables: { input: { id: plan.id } }, token: token
          mutation DeletePlan($input: DeletePlanInput!) {
            deletePlan(input: $input) { deletedPlanId }
          }
        GRAPHQL
      )

      expect(result.dig("data", "deletePlan", "deletedPlanId")).to eq(plan.id)
      expect(StudyPlan.exists?(plan.id)).to be(false)
      expect(KnowledgeNode.exists?(node.id)).to be(false)
      expect(Material.exists?(material.id)).to be(false)
      expect(ReadingProgress.exists?(progress.id)).to be(false)
    end

    it "answers NOT_FOUND for another user's plan id and deletes nothing" do
      owner, _owner_token = user_with_token("delete-owner@example.com")
      _attacker, attacker_token = user_with_token("delete-attacker@example.com")
      plan = create(:study_plan, user: owner)
      node = create(:knowledge_node, user: owner, plan: plan)

      result = graphql(
        <<~GRAPHQL, variables: { input: { id: plan.id } }, token: attacker_token
          mutation DeletePlan($input: DeletePlanInput!) {
            deletePlan(input: $input) { deletedPlanId }
          }
        GRAPHQL
      )

      expect(result.dig("data", "deletePlan")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(StudyPlan.exists?(plan.id)).to be(true)
      expect(KnowledgeNode.exists?(node.id)).to be(true)
    end
  end

  private

  def input_for(client_uuid)
    {
      clientUuid: client_uuid,
      topic: "graphQL epic",
      goal: "ship it",
      nodes: [
        { title: "commands", stage: "基础" },
        { title: "scoping", stage: nil }
      ]
    }
  end

  def proposal_input(client_uuid)
    {
      clientUuid: client_uuid,
      topic: "graphQL epic",
      stages: [
        { name: "基础", nodeTitles: [ "graphql basics", "commands" ] },
        { name: "核心", nodeTitles: [ "scoping" ] }
      ]
    }
  end
end
