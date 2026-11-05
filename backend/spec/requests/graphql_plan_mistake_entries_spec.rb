# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL planMistakeEntries (epic P2-12 T3, FR-46)", type: :request do
  # The plan companion's "analyze my mistakes" picker read: every entry whose
  # node belongs to the plan, in log order. Bare list read (the sanctioned
  # reads carve-out — the scoping IS the logic): user-scoped through the
  # caller's own association paths (AD-13); foreign/malformed plan ids are
  # uniformly NOT_FOUND (kickoff delta 2). Direct GraphQL over HTTP (AD-10,
  # the epic-02 request-spec pattern).
  def query_entries(token, variables)
    graphql(
      <<~GRAPHQL, variables: variables, token: token
        query PlanMistakes($planId: String!) {
          planMistakeEntries(planId: $planId) {
            id questionId nodeId userAnswer forfeited createdAt
            sourceLocation { kind page sectionId }
            question { prompt sourceMaterialId sourceSectionId }
          }
        }
      GRAPHQL
    )
  end

  it "answers every entry whose node belongs to the plan (and nothing of other plans) with the question readable" do
    owner, token = user_with_token("plan-mistake-owner@example.com")
    owner_plan = create(:study_plan, user: owner)
    other_plan = create(:study_plan, user: owner)
    node_a = create(:knowledge_node, user: owner, plan: owner_plan, title: "Consensus", order: 0)
    other_node = create(:knowledge_node, user: owner, plan: other_plan, title: "Elsewhere", order: 0)
    material = create(:material, user: owner, plan: owner_plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
    ])
    q1 = create(:question, user: owner, node: node_a, source_material: material, prompt: "First?")
    q2 = create(:question, user: owner, node: node_a, source_material: material, source_section_id: "sec-1", prompt: "Second?")
    q_other = create(:question, user: owner, node: other_node, source_material: material, prompt: "Elsewhere?")
    create(:mistake_entry, user: owner, question: q1, node: node_a)
    create(:mistake_entry, user: owner, question: q2, node: node_a, source_location: { "kind" => "pdf", "page" => 3 })
    create(:mistake_entry, user: owner, question: q_other, node: other_node)

    result = query_entries(token, { planId: owner_plan.id })
    rows = result.dig("data", "planMistakeEntries")
    expect(rows.length).to eq(2) # the other plan's entry is not the plan's
    expect(rows.map { |r| r["questionId"] }).to eq([ q1.id, q2.id ]) # (created_at, id) order
    expect(rows.first["question"]["prompt"]).to eq("First?")
    expect(rows.second["question"]["sourceSectionId"]).to eq("sec-1")
    expect(rows.second["sourceLocation"]).to eq({ "kind" => "pdf", "page" => 3, "sectionId" => nil })
  end

  it "excludes entries whose node belongs to no plan (task nodes)" do
    owner, token = user_with_token("plan-mistake-task@example.com")
    owner_plan = create(:study_plan, user: owner)
    plan_node = create(:knowledge_node, user: owner, plan: owner_plan)
    task_node = create(:knowledge_node, user: owner) # no plan — a Study Task's node
    material = create(:material, user: owner)
    q_plan = create(:question, user: owner, node: plan_node, source_material: material)
    q_task = create(:question, user: owner, node: task_node, source_material: material)
    create(:mistake_entry, user: owner, question: q_plan, node: plan_node)
    create(:mistake_entry, user: owner, question: q_task, node: task_node)

    result = query_entries(token, { planId: owner_plan.id })
    rows = result.dig("data", "planMistakeEntries")
    expect(rows.map { |r| r["nodeId"] }).to eq([ plan_node.id ])
  end

  it "answers NOT_FOUND uniformly for a foreign, unknown, and malformed plan id" do
    owner, token = user_with_token("plan-mistake-scope@example.com")
    other = create(:user)
    foreign_plan = create(:study_plan, user: other)

    result = query_entries(token, { planId: foreign_plan.id })
    expect(error_code(result)).to eq("NOT_FOUND")

    result = query_entries(token, { planId: SecureRandom.uuid })
    expect(error_code(result)).to eq("NOT_FOUND")

    result = query_entries(token, { planId: "not-a-uuid" })
    expect(error_code(result)).to eq("NOT_FOUND")
  end

  it "answers UNAUTHORIZED without a token" do
    plan = create(:study_plan, user: create(:user))
    result = query_entries(nil, { planId: plan.id })
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end
end
