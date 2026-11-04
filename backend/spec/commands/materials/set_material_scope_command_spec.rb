# frozen_string_literal: true

require "rails_helper"

RSpec.describe Materials::SetMaterialScopeCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam. This is the "re-attach plan-wide widens" flow's own op
  # (FR-44, epic P2-10 T2): pin (scope=node + nodeId) / unpin=widen
  # (scope=plan) on an EXISTING material — attachMaterial's idempotent replay
  # is deliberately NOT overloaded for it.

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Consensus") }
  let(:material) { create(:material, user: user, plan: plan) }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: material.id,
      attachment_scope: "node",
      node_id: node.id,
      **overrides
    )
  end

  describe ".call" do
    it "pins a plan-wide material to a plan node" do
      result = call

      expect(result.success?).to be(true)
      pinned = result.value![:material]
      expect(pinned.attachment_scope).to eq("node")
      expect(pinned.node_id).to eq(node.id)
    end

    it "is idempotent: the same pin returns the row unchanged (no write churn)" do
      first = call
      stamped_at = first.value![:material].updated_at
      updated_at_before = material.reload.updated_at

      replay = call

      aggregate_failures do
        expect(replay.success?).to be(true)
        expect(replay.value![:material].id).to eq(material.id)
        expect(replay.value![:material].attachment_scope).to eq("node")
        expect(replay.value![:material].node_id).to eq(node.id)
        expect(material.reload.updated_at).to eq(updated_at_before)
      end
      expect(stamped_at).to eq(updated_at_before) # the pin itself wrote once
    end

    it "moves the pin when re-pinned to another node of the same plan" do
      other_node = create(:knowledge_node, user: user, plan: plan, title: "Gossip")
      call
      moved = call(node_id: other_node.id)

      aggregate_failures do
        expect(moved.value![:material].attachment_scope).to eq("node")
        expect(moved.value![:material].node_id).to eq(other_node.id)
      end
      expect(material.reload.node_id).to eq(other_node.id)
    end

    it "widens: scope=plan clears the pin (re-attach plan-wide widens, FR-44)" do
      call

      widened = described_class.call(
        current_user: user, material_id: material.id, attachment_scope: "plan", node_id: nil
      )

      aggregate_failures do
        expect(widened.success?).to be(true)
        expect(widened.value![:material].attachment_scope).to eq("plan")
        expect(widened.value![:material].node_id).to be_nil
      end
      expect(material.reload.node_id).to be_nil
    end

    it "fails VALIDATION_FAILED when widening carries a nodeId (nodeId must be null on widen)" do
      call

      widened = described_class.call(
        current_user: user, material_id: material.id, attachment_scope: "plan", node_id: node.id
      )

      aggregate_failures do
        expect(widened.failure.code).to eq(:VALIDATION_FAILED)
        expect(widened.failure.context[:field]).to eq(:nodeId)
      end
      expect(material.reload.attachment_scope).to eq("node") # unchanged
    end

    it "fails VALIDATION_FAILED when pinning without a nodeId" do
      result = call(node_id: nil)

      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:nodeId)
      expect(material.reload.attachment_scope).to eq("plan")
    end

    it "fails VALIDATION_FAILED for a scope outside the closed vocabulary" do
      result = call(attachment_scope: "section")

      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:attachmentScope)
    end

    it "fails VALIDATION_FAILED when pinning a task material (the task triangle has no node pinning)" do
      task_material = create(:study_task, user: user).material

      result = described_class.call(
        current_user: user, material_id: task_material.id, attachment_scope: "node", node_id: node.id
      )

      aggregate_failures do
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:taskId)
      end
      expect(task_material.reload.attachment_scope).to eq("plan")
    end

    it "widens a task material harmlessly (it reads plan-wide already — the idempotent no-op)" do
      task_material = create(:study_task, user: user).material

      result = described_class.call(
        current_user: user, material_id: task_material.id, attachment_scope: "plan", node_id: nil
      )

      expect(result.success?).to be(true)
      expect(task_material.reload.attachment_scope).to eq("plan")
    end

    it "fails VALIDATION_FAILED when the node is not in the material's plan" do
      other_plan = create(:study_plan, user: user)
      foreign_node = create(:knowledge_node, user: user, plan: other_plan, title: "Elsewhere")

      result = call(node_id: foreign_node.id)

      aggregate_failures do
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:nodeId)
      end
      expect(material.reload.attachment_scope).to eq("plan")
    end

    it "fails VALIDATION_FAILED when pinning a plan-less material (no plan holds the node)" do
      orphan = create(:material, user: user)

      result = described_class.call(
        current_user: user, material_id: orphan.id, attachment_scope: "node", node_id: node.id
      )

      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:nodeId)
      expect(orphan.reload.attachment_scope).to eq("plan")
    end

    it "answers NOT_FOUND for an unknown, foreign, or malformed material id (uniform, delta 2)" do
      foreign = create(:material, user: create(:user))

      aggregate_failures do
        expect(call(material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
        expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
        expect(call(material_id: "garbage").failure.code).to eq(:NOT_FOUND)
      end
    end

    it "answers NOT_FOUND for an unknown, foreign, or malformed node id (uniform, no existence leak)" do
      foreign_node = create(:knowledge_node, user: create(:user), plan: create(:study_plan, user: create(:user)))

      aggregate_failures do
        expect(call(node_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
        expect(call(node_id: foreign_node.id).failure.code).to eq(:NOT_FOUND)
        expect(call(node_id: "garbage").failure.code).to eq(:NOT_FOUND)
      end
      expect(material.reload.attachment_scope).to eq("plan")
    end
  end
end
