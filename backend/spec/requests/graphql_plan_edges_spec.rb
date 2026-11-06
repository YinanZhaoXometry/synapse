# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL plan edges + node metadata (epic-16 T1, FR-5 data half)", type: :request do
  # The roadmap data model on the wire: creation carries node metadata +
  # id-paired edges, the plan read exposes the edges (endpoint id pairs), and
  # every edge drop rule degrades silently-but-deterministically — an invalid
  # edge never blocks creation (AD-12: no new error values) and never reaches
  # the stored graph. The commands underneath have their own direct specs;
  # this file pins the wire behavior, each rule as its own request case.

  def create_plan(input, token)
    graphql(<<~GRAPHQL, variables: { input: input }, token: token)
      mutation CreatePlan($input: CreatePlanInput!) {
        createPlan(input: $input) {
          plan { id nodes { title description optional } edges { fromNodeId toNodeId } }
          nodes { id description optional }
        }
      }
    GRAPHQL
  end

  def read_plan(plan_id, token)
    graphql("query($id: String!) { plan(id: $id) { nodes { title description optional } edges { fromNodeId toNodeId } } }",
            variables: { id: plan_id }, token: token)
  end

  describe "createPlan with node metadata + edges" do
    it "persists node descriptions/optional flags and the edges as endpoint id pairs" do
      user, token = user_with_token("roadmap-creator@example.com")
      input = roadmap_input(SecureRandom.uuid)

      result = create_plan(input, token)

      payload = result.dig("data", "createPlan")
      expect(error_code(result)).to be_nil
      nodes = payload["plan"]["nodes"]
      expect(nodes.map { |n| n["title"] }).to eq([ "foundations", "practice" ])
      expect(nodes.map { |n| n["description"] }).to eq([ "the spine first", nil ])
      expect(nodes.map { |n| n["optional"] }).to eq([ false, true ])

      # The endpoints are the created nodes' real uuids, from → to.
      plan = user.study_plans.find(payload["plan"]["id"])
      foundations, practice = plan.knowledge_nodes.order(:order).to_a
      expect(payload["plan"]["edges"]).to eq([
        { "fromNodeId" => foundations.id, "toNodeId" => practice.id }
      ])
    end

    it "drops an edge whose endpoint is not one of the plan's own nodes — creation succeeds" do
      user, token = user_with_token("edge-member@example.com")
      # A stronger membership probe than a random uuid: the endpoint is a real
      # node the caller owns — but of ANOTHER plan, so it is not a member here.
      other_plan = create(:study_plan, user: user)
      foreign_node = create(:knowledge_node, user: user, plan: other_plan, stage: "基础")
      input = create_input(SecureRandom.uuid,
                           [ { title: "first", stage: "基础" }, { title: "second", stage: "核心" } ],
                           [ { fromNodeId: foreign_node.id, toNodeId: SecureRandom.uuid } ])

      result = create_plan(input, token)

      expect(error_code(result)).to be_nil
      plan = user.study_plans.find(result.dig("data", "createPlan", "plan", "id"))
      expect(plan.knowledge_nodes.count).to eq(2)
      expect(plan.knowledge_node_edges).to be_empty
    end

    it "drops a same-stage edge (the stage-forward rule's equal-index case)" do
      user, token = user_with_token("edge-same-stage@example.com")
      input = create_input(SecureRandom.uuid,
                           [ { title: "first", stage: "基础" }, { title: "second", stage: "基础" } ],
                           [ { fromNodeId: "@first", toNodeId: "@second" } ])

      result = create_plan(input, token)

      expect(error_code(result)).to be_nil
      plan = user.study_plans.find(result.dig("data", "createPlan", "plan", "id"))
      expect(plan.knowledge_node_edges).to be_empty
    end

    it "drops a backward edge (later stage pointing at an earlier one)" do
      user, token = user_with_token("edge-backward@example.com")
      input = create_input(SecureRandom.uuid,
                           [ { title: "early", stage: "基础" }, { title: "late", stage: "核心" } ],
                           [ { fromNodeId: "@second", toNodeId: "@first" } ])

      result = create_plan(input, token)

      expect(error_code(result)).to be_nil
      plan = user.study_plans.find(result.dig("data", "createPlan", "plan", "id"))
      expect(plan.knowledge_node_edges).to be_empty
    end

    it "drops an edge touching a stageless node (no stage index to order by)" do
      user, token = user_with_token("edge-stageless@example.com")
      input = create_input(SecureRandom.uuid,
                           [ { title: "staged", stage: "基础" }, { title: "stageless", stage: nil } ],
                           [ { fromNodeId: "@first", toNodeId: "@second" } ])

      result = create_plan(input, token)

      expect(error_code(result)).to be_nil
      plan = user.study_plans.find(result.dig("data", "createPlan", "plan", "id"))
      expect(plan.knowledge_node_edges).to be_empty
    end

    it "dedupes a repeated [from, to] pair into one stored edge" do
      user, token = user_with_token("edge-dedupe@example.com")
      input = create_input(SecureRandom.uuid,
                           [ { title: "first", stage: "基础" }, { title: "second", stage: "核心" } ],
                           [ { fromNodeId: "@first", toNodeId: "@second" },
                             { fromNodeId: "@first", toNodeId: "@second" } ])

      result = create_plan(input, token)

      expect(error_code(result)).to be_nil
      plan = user.study_plans.find(result.dig("data", "createPlan", "plan", "id"))
      expect(plan.knowledge_node_edges.count).to eq(1)
    end

    it "fails VALIDATION_FAILED when a supplied node id belongs to another user (nothing created)" do
      user, token = user_with_token("edge-id-owner@example.com")
      owner = create(:user)
      owned = create(:knowledge_node, user: owner, stage: "基础")
      input = create_input(SecureRandom.uuid,
                           [ { title: "stolen", stage: "核心", id: owned.id } ], [])

      result = create_plan(input, token)

      expect(result.dig("data", "createPlan")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(user.study_plans.count).to eq(0)
      expect(user.knowledge_nodes.where(title: "stolen")).to be_empty
    end

    it "replays an edge-carrying create without duplicating edges (delta 3)" do
      user, token = user_with_token("edge-replayer@example.com")
      client_uuid = SecureRandom.uuid
      graphql(<<~GRAPHQL, variables: { input: roadmap_input(client_uuid) }, token: token)
        mutation CreatePlan($input: CreatePlanInput!) {
          createPlan(input: $input) { plan { id } }
        }
      GRAPHQL

      replay = graphql(<<~GRAPHQL, variables: { input: roadmap_input(client_uuid) }, token: token)
        mutation CreatePlan($input: CreatePlanInput!) {
          createPlan(input: $input) { plan { id edges { fromNodeId toNodeId } } }
        }
      GRAPHQL

      expect(error_code(replay)).to be_nil
      plan = user.study_plans.find(client_uuid)
      expect(plan.knowledge_node_edges.count).to eq(1)
    end
  end

  describe "the plan read exposes the stored graph" do
    it "reads description/optional back on the nodes and edges as endpoint id pairs" do
      user, token = user_with_token("roadmap-reader@example.com")
      input = roadmap_input(SecureRandom.uuid)
      create_plan(input, token)
      plan = user.study_plans.sole
      foundations, practice = plan.knowledge_nodes.order(:order).to_a

      payload = read_plan(plan.id, token).dig("data", "plan")

      expect(payload["nodes"].map { |n| n["description"] }).to eq([ "the spine first", nil ])
      expect(payload["nodes"].map { |n| n["optional"] }).to eq([ false, true ])
      expect(payload["edges"]).to eq([
        { "fromNodeId" => foundations.id, "toNodeId" => practice.id }
      ])
    end
  end

  describe "confirmProposal with the upgraded proposal shape" do
    def confirm_proposal(input, token, fields)
      graphql(<<~GRAPHQL, variables: { input: input }, token: token)
        mutation ConfirmProposal($input: ConfirmProposalInput!) {
          confirmProposal(input: $input) { #{fields} }
        }
      GRAPHQL
    end

    it "confirms stage nodes with metadata and resolves title-paired edges server-side" do
      user, token = user_with_token("proposal-confirmer@example.com")
      client_uuid = SecureRandom.uuid

      result = confirm_proposal(proposal_input(client_uuid), token,
                                "plan { id nodes { title description optional } edges { fromNodeId toNodeId } }")

      expect(error_code(result)).to be_nil
      payload = result.dig("data", "confirmProposal")
      expect(payload["plan"]["nodes"].map { |n| n["optional"] }).to eq([ false, true ])

      plan = user.study_plans.find(client_uuid)
      basics, advanced = plan.knowledge_nodes.order(:order).to_a
      expect(payload["plan"]["edges"]).to eq([
        { "fromNodeId" => basics.id, "toNodeId" => advanced.id }
      ])
    end

    it "drops an edge whose title matches duplicate node titles (unresolvable — deterministic)" do
      _user, token = user_with_token("proposal-dup-title@example.com")
      client_uuid = SecureRandom.uuid

      result = confirm_proposal(dup_title_input(client_uuid), token,
                                "plan { nodes { title } edges { fromNodeId toNodeId } }")

      expect(error_code(result)).to be_nil
      payload = result.dig("data", "confirmProposal")
      expect(payload["plan"]["nodes"].map { |n| n["title"] }).to eq([ "same", "same", "later" ])
      expect(payload["plan"]["edges"]).to eq([])
    end

    it "keeps confirming the legacy nodeTitles shape (no metadata, no edges)" do
      _user, token = user_with_token("proposal-legacy@example.com")
      client_uuid = SecureRandom.uuid

      result = confirm_proposal(legacy_proposal_input(client_uuid), token,
                                "plan { nodes { title optional } edges { fromNodeId toNodeId } }")

      expect(error_code(result)).to be_nil
      payload = result.dig("data", "confirmProposal")
      expect(payload["plan"]["nodes"].map { |n| n["optional"] }).to eq([ false, false ])
      expect(payload["plan"]["edges"]).to eq([])
    end
  end

  private

  # The minimal truthful roadmap: an optional practice node one stage ahead of
  # its foundations prerequisite — the one happy-path edge the cases read back.
  def roadmap_input(client_uuid)
    create_input(
      client_uuid,
      [
        { title: "foundations", stage: "基础", description: "the spine first" },
        { title: "practice", stage: "核心", optional: true }
      ],
      [ { fromNodeId: "@first", toNodeId: "@second" } ]
    )
  end

  # Nodes are positionally identified: a client-supplied id is minted per node
  # (the server accepts client-supplied node ids, AD-12), and "@first"/"@second"
  # in an edge endpoint resolves to that position's id.
  def create_input(client_uuid, nodes, edges)
    ids = nodes.map { |node| node[:id] ||= SecureRandom.uuid }
    aliases = { "@first" => ids[0], "@second" => ids[1] }
    edges = edges.map do |edge|
      {
        fromNodeId: aliases.fetch(edge[:fromNodeId], edge[:fromNodeId]),
        toNodeId: aliases.fetch(edge[:toNodeId], edge[:toNodeId])
      }
    end
    { clientUuid: client_uuid, topic: "roadmap graph", nodes: nodes, edges: edges }
  end

  def proposal_input(client_uuid)
    {
      clientUuid: client_uuid,
      topic: "graphQL epic",
      stages: [
        { name: "基础", nodes: [ { title: "basics" } ] },
        { name: "核心", nodes: [ { title: "advanced", description: "the deep cut", optional: true } ] }
      ],
      edges: [ { fromTitle: "basics", toTitle: "advanced" } ]
    }
  end

  def dup_title_input(client_uuid)
    {
      clientUuid: client_uuid,
      topic: "graphQL epic",
      stages: [
        { name: "基础", nodes: [ { title: "same" }, { title: "same" } ] },
        { name: "核心", nodes: [ { title: "later" } ] }
      ],
      edges: [ { fromTitle: "same", toTitle: "later" } ]
    }
  end

  def legacy_proposal_input(client_uuid)
    {
      clientUuid: client_uuid,
      topic: "graphQL epic",
      stages: [
        { name: "基础", nodeTitles: [ "basics" ] },
        { name: "核心", nodeTitles: [ "advanced" ] }
      ]
    }
  end
end
