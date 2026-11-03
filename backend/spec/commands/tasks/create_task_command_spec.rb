# frozen_string_literal: true

require "rails_helper"

RSpec.describe Tasks::CreateTaskCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }
  let(:client_uuid) { SecureRandom.uuid }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      material_id: material.id,
      **overrides
    )
  end

  describe ".call" do
    it "creates the task and its single auto-owned node, and back-fills the material's task link" do
      result = call

      expect(result.success?).to be(true)
      task = result.value![:task]
      node = result.value![:node]

      expect(task.id).to eq(client_uuid)
      expect(task.user_id).to eq(user.id)
      expect(task.material_id).to eq(material.id)
      expect(task.node_id).to eq(node.id)

      # AD-6: the task's exactly-one auto-created node — planId null, taskId
      # set; Phase-1 createStudyTask titles it after the material, stageless,
      # at order 0.
      expect(node.plan_id).to be_nil
      expect(node.task_id).to eq(task.id)
      expect(node.title).to eq(material.title)
      expect(node.stage).to be_nil
      expect(node.order).to eq(0)
      expect(node.user_id).to eq(user.id)

      # The Phase-1 back-fill: the studied material points back at the task.
      expect(material.reload.task_id).to eq(task.id)
    end

    it "persists the rows (real, findable through the owner's scope)" do
      result = call

      task = result.value![:task]
      expect(user.study_tasks.find(task.id)).to eq(task)
      expect(user.knowledge_nodes.find_by(task_id: task.id)).to eq(result.value![:node])
    end

    it "is idempotent on replay with the same client uuid (delta 3): Success, same rows, no duplicates" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:task].id).to eq(first.value![:task].id)
      expect(replay.value![:node].id).to eq(first.value![:node].id)
      expect(user.study_tasks.where(id: client_uuid).count).to eq(1)
      expect(user.study_tasks.count).to eq(1)
      expect(user.knowledge_nodes.where(task_id: client_uuid).count).to eq(1)
      # The replayed material link still points at the one task.
      expect(material.reload.task_id).to eq(first.value![:task].id)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (never silently link, FR-4)" do
      other = create(:user)
      foreign_task = create(:study_task, user: other)

      result = call(client_uuid: foreign_task.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_tasks.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_tasks.count).to eq(0)
    end

    it "answers NOT_FOUND for an unknown material id" do
      result = call(material_id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.study_tasks.count).to eq(0)
      expect(user.knowledge_nodes.count).to eq(0)
    end

    it "answers NOT_FOUND for another user's material id (uniform NOT_FOUND, delta 2)" do
      foreign_material = create(:material, user: create(:user))

      result = call(material_id: foreign_material.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.study_tasks.count).to eq(0)
    end

    it "answers NOT_FOUND for a material id that is not uuid-shaped (a malformed address is no row)" do
      result = call(material_id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "fails VALIDATION_FAILED when the material already belongs to a study task (the ER's one-task-per-material)" do
      # The factory's triangle: the material is already back-linked to a task.
      tasked_material = create(:study_task, user: user).material

      result = call(material_id: tasked_material.id, client_uuid: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_tasks.count).to eq(1)
      expect(tasked_material.reload.task_id).not_to eq(client_uuid)
    end
  end
end
