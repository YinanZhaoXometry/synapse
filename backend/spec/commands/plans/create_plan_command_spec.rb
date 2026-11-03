# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::CreatePlanCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:client_uuid) { SecureRandom.uuid }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      topic: "COMP5241 software engineering",
      goal: "pass the course",
      visibility: nil,
      nodes: [ { title: "Command layer", stage: "基础" }, { title: "Spine ER", stage: nil } ],
      **overrides
    )
  end

  describe ".call" do
    it "creates the plan and its nodes in order, and returns them" do
      result = call

      expect(result.success?).to be(true)
      plan = result.value![:plan]
      nodes = result.value![:nodes]

      expect(plan.id).to eq(client_uuid)
      expect(plan.topic).to eq("COMP5241 software engineering")
      expect(plan.goal).to eq("pass the course")
      # FR-38: private by default — the Phase-1 TS shape has no visibility,
      # so the server default is the only source of it.
      expect(plan.visibility).to eq("private")
      expect(plan.user_id).to eq(user.id)

      expect(nodes.map(&:title)).to eq([ "Command layer", "Spine ER" ])
      expect(nodes.map(&:stage)).to eq([ "基础", nil ])
      expect(nodes.map(&:order)).to eq([ 0, 1 ])
      expect(nodes.map(&:plan_id).uniq).to eq([ plan.id ])
      expect(nodes.map(&:task_id).uniq).to eq([ nil ])
      expect(nodes.map(&:user_id).uniq).to eq([ user.id ])
    end

    it "persists the rows (real, findable through the owner's scope)" do
      result = call

      plan = result.value![:plan]
      expect(user.study_plans.find(plan.id)).to eq(plan)
      expect(user.knowledge_nodes.where(plan_id: plan.id).count).to eq(2)
    end

    it "is idempotent on replay with the same client uuid (delta 3): Success, same row, no duplicates" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(first.value![:plan].id)
      expect(user.study_plans.where(id: client_uuid).count).to eq(1)
      expect(user.knowledge_nodes.where(plan_id: client_uuid).count).to eq(2)
      expect(replay.value![:nodes].map(&:id)).to match_array(first.value![:nodes].map(&:id))
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (never silently link, FR-4)" do
      call
      other = create(:user)

      result = described_class.call(
        current_user: other,
        client_uuid: client_uuid,
        topic: "another topic",
        goal: nil,
        nodes: [ { title: "a node", stage: nil } ]
      )

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(other.study_plans.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank topic" do
      result = call(topic: "   ")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for an empty node list (the Phase-1 EMPTY_PLAN_PROPOSAL rule)" do
      result = call(nodes: [])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when a node title is blank" do
      result = call(nodes: [ { title: "ok", stage: nil }, { title: "  ", stage: nil } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
      expect(user.knowledge_nodes.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a visibility outside the enum" do
      result = call(visibility: "unlisted")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
    end

    it "accepts the public visibility (FR-38 Square opt-in passthrough)" do
      result = call(visibility: "public")

      expect(result.value![:plan].visibility).to eq("public")
    end
  end
end
