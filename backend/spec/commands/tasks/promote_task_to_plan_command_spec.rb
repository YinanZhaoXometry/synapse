# frozen_string_literal: true

require "rails_helper"

RSpec.describe Tasks::PromoteTaskToPlanCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.
  #
  # FR-37 stretch half (epic-14 T2, delta decision 4): the task's single
  # auto-node KEEPS ITS ID and gains plan_id (evidence untouched — only plan
  # linkage changes, so scores carry over by construction); the material
  # re-points plan-wide; the task row becomes a read-only pointer
  # (promoted_plan_id + promoted_at, INFERRED promoted state). Idempotent on
  # the client uuid per the house law — AND at the task level: an
  # already-promoted task returns the existing pointer.

  let(:user) { create(:user) }
  let(:task) { create(:study_task, user: user) }
  let(:client_uuid) { SecureRandom.uuid }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      task_id: task.id,
      client_uuid: client_uuid,
      **overrides
    )
  end

  # The score-continuity reader (the spec's independent truth): Mastery over
  # the node's evidence records — the SAME call the wire makes, with `now`
  # injected identically on both sides.
  def node_score(node_id, now:)
    records = user.evidence_records.where(node_id: node_id)
    Mastery.compute_node_score(records, now: now)
  end

  describe ".call" do
    it "creates a private plan, moves the node into it (SAME id), and re-points the material plan-wide" do
      node_id = task.node_id
      material_id = task.material_id

      result = call

      expect(result.success?).to be(true)
      plan = result.value![:plan]
      promoted_task = result.value![:task]

      # The new plan: the caller's, private (FR-38 default), goal null, and
      # the client uuid IS the plan's id (the create-side idempotency key).
      expect(plan.id).to eq(client_uuid)
      expect(plan.user_id).to eq(user.id)
      expect(plan.visibility).to eq("private")
      expect(plan.goal).to be_nil

      # The node moved, it did not multiply: the SAME row — id stable (delta
      # decision 4: evidence untouched, ids stable) — now plan-side, task-less.
      node = user.knowledge_nodes.find(node_id)
      expect(node.plan_id).to eq(plan.id)
      expect(node.task_id).to be_nil

      # The material re-points: plan_id → the new plan, the task back-link
      # cleared; the attachment scope stays what task attach set ("plan").
      material = user.materials.find(material_id)
      expect(material.plan_id).to eq(plan.id)
      expect(material.task_id).to be_nil
      expect(material.attachment_scope).to eq("plan")

      # The task row is now the read-only pointer: content moved away, the
      # promotion stamped (promoted state INFERRED from the non-null id).
      expect(promoted_task.reload.promoted_plan_id).to eq(plan.id)
      expect(promoted_task.promoted_at).to be_present
      expect(promoted_task.node_id).to eq(node_id)
      expect(promoted_task.material_id).to eq(material_id)
      expect(user.study_plans.count).to eq(1)
    end

    it "defaults the plan topic to the task's material title when the client sends none (StudyTask carries no title)" do
      result = call

      expect(result.value![:plan].topic).to eq(task.material.title)
    end

    it "uses the client-sent topic for the new plan" do
      result = call(topic: "期末复习计划")

      expect(result.value![:plan].topic).to eq("期末复习计划")
    end

    it "keeps scores identical through promotion: SAME node id, same evidence, same Mastery result" do
      # A real evidence graph on the task's node (the factory graph, one owner).
      create_list(:evidence_record, 3, user: user, node: task.node)
      node_id = task.node_id
      # Frozen `now` so freshness decay cannot differ between the two reads.
      now = Time.current

      before = node_score(node_id, now: now)
      expect(before).to be > 0 # the graph is live — the comparison is not vacuous

      result = call

      expect(result.success?).to be(true)
      expect(result.value![:node].id).to eq(node_id) # the same node, by identity
      expect(node_score(node_id, now: now)).to eq(before)
      # The node rides the plan's tree now — the plan rollup sees the SAME
      # evidence (the plan's only node, so the rollup equals the node score).
      records = user.evidence_records.where(node_id: node_id)
      expect(Mastery.compute_plan_rollup({ node_id => records }, now: now)).to eq(before)
      # No evidence row moved or multiplied.
      expect(user.evidence_records.where(node_id: node_id).count).to eq(3)
    end

    it "is idempotent on replay with the same client uuid (delta 3): Success, the promoted plan, no second plan" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(first.value![:plan].id)
      expect(user.study_plans.count).to eq(1)
      expect(user.study_tasks.where(id: task.id).count).to eq(1)
    end

    it "returns the existing pointer for an already-promoted task — idempotent at the TASK level too, whatever uuid rides" do
      first = call
      other_uuid = SecureRandom.uuid

      replay = call(client_uuid: other_uuid)

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(first.value![:plan].id)
      expect(user.study_plans.count).to eq(1)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user's plan (never silently link, FR-4)" do
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)

      result = call(client_uuid: foreign_plan.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(task.reload.promoted_plan_id).to be_nil # nothing moved
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(task.reload.promoted_plan_id).to be_nil
    end

    it "falls back to the material-title default when the client sends a whitespace-only topic" do
      result = call(topic: "   ")

      expect(result.success?).to be(true)
      expect(result.value![:plan].topic).to eq(task.material.title)
    end

    it "answers NOT_FOUND for an unknown task id" do
      result = call(task_id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.study_plans.count).to eq(0)
    end

    it "answers NOT_FOUND for another user's task id (uniform NOT_FOUND, delta 2)" do
      foreign_task = create(:study_task, user: create(:user))

      result = call(task_id: foreign_task.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(foreign_task.reload.promoted_plan_id).to be_nil
    end

    it "answers NOT_FOUND for a task id that is not uuid-shaped (a malformed address is no row)" do
      result = call(task_id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "refuses a task whose node or material is gone (nothing to promote — VALIDATION_FAILED, honest)" do
      # The state is unreachable under the schema (study_tasks.material_id /
      # node_id are NOT NULL FKs), which is exactly why the guard exists —
      # schema drift insurance. The spec constructs it by suspending the FK
      # triggers for this session (the compose postgres user is a superuser);
      # the whole example rolls back with the transactional fixture.
      conn = ActiveRecord::Base.connection
      conn.execute("SET session_replication_role = replica")
      conn.execute("DELETE FROM knowledge_nodes WHERE id = '#{task.node_id}'")
      conn.execute("SET session_replication_role = DEFAULT")

      result = call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.study_plans.count).to eq(0)
    end

    it "keeps the task's quiz sessions loadable after promotion (the sessions reference the task, which still exists)" do
      session = create(:quiz_session, user: user, task: task, plan: nil)

      result = call

      expect(result.success?).to be(true)
      expect(session.reload.task_id).to eq(task.id)
      expect(user.quiz_sessions.find(session.id).task_id).to eq(task.id)
      expect(session.reload.plan_id).to be_nil # a task-scope session stays task-scope
    end
  end
end
