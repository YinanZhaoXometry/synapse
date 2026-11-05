# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::DeletePlanCommand do
  # Direct command testing (AD-10). Phase-1 deletePlan (plan-repository.ts)
  # cascades plan + nodes + materials + their 1:1 rows (ReadingProgress,
  # ChatThread) in one transaction; the server adds the FK-mandated sweeps
  # for the rows the ER forbids leaving dangling (quiz/evidence/marking
  # graph) — see the command's comments.

  let(:user) { create(:user) }
  let!(:plan) { create(:study_plan, user: user) }
  let!(:node) { create(:knowledge_node, user: user, plan: plan) }
  let!(:material) { create(:material, user: user, plan: plan) }
  let!(:progress) { create(:reading_progress, user: user, material: material) }
  let!(:thread) { create(:chat_thread, user: user, material: material) }
  let!(:flashcard) { create(:flashcard, user: user, material: material) }
  let!(:annotation) { create(:annotation, user: user, material: material) }
  let!(:marking) { create(:section_marking, user: user, material: material) }
  let!(:session) { create(:quiz_session, user: user, plan: plan) }
  let!(:question) do
    create(:question, user: user, session: session, node: node, source_material: material)
  end
  let!(:evidence) do
    create(:evidence_record, user: user, node: node, session: session, question: question)
  end
  let!(:mistake) do
    create(:mistake_entry, user: user, question: question, node: node, session: session)
  end

  # Survivors inside the same user's graph: the plan-free Study Task triangle
  # (AD-6 — its node has plan_id null) and a material that is not attached
  # to this plan.
  let!(:task) { create(:study_task, user: user) }
  let!(:detached_material) { create(:material, user: user) }
  let!(:detached_progress) { create(:reading_progress, user: user, material: detached_material) }

  # Survivors outside the user: another user's plan graph must be untouched.
  let(:other) { create(:user) }
  let!(:foreign_plan) { create(:study_plan, user: other) }
  let!(:foreign_node) { create(:knowledge_node, user: other, plan: foreign_plan) }
  let!(:foreign_material) { create(:material, user: other, plan: foreign_plan) }

  def call(overrides = {})
    described_class.call(current_user: user, id: plan.id, **overrides)
  end

  describe ".call" do
    it "deletes the plan and everything hanging off it, in one transaction" do
      result = call

      expect(result.success?).to be(true)
      expect(result.value![:deleted_plan_id]).to eq(plan.id)

      expect(StudyPlan.exists?(plan.id)).to be(false)
      expect(KnowledgeNode.exists?(node.id)).to be(false)
      expect(Material.exists?(material.id)).to be(false)
      expect(ReadingProgress.exists?(progress.id)).to be(false)
      expect(ChatThread.exists?(thread.id)).to be(false)
      expect(Flashcard.exists?(flashcard.id)).to be(false)
      expect(Annotation.exists?(annotation.id)).to be(false)
      expect(SectionMarking.exists?(marking.id)).to be(false)
      expect(QuizSession.exists?(session.id)).to be(false)
      expect(Question.exists?(question.id)).to be(false)
      expect(EvidenceRecord.exists?(evidence.id)).to be(false)
      expect(MistakeEntry.exists?(mistake.id)).to be(false)
    end

    it "leaves the user's plan-free rows alone (task triangle, detached material)" do
      call

      expect(StudyTask.exists?(task.id)).to be(true)
      expect(KnowledgeNode.exists?(task.node_id)).to be(true)
      expect(Material.exists?(task.material_id)).to be(true)
      expect(Material.exists?(detached_material.id)).to be(true)
      expect(ReadingProgress.exists?(detached_progress.id)).to be(true)
    end

    it "leaves other users' rows alone" do
      call

      expect(StudyPlan.exists?(foreign_plan.id)).to be(true)
      expect(KnowledgeNode.exists?(foreign_node.id)).to be(true)
      expect(Material.exists?(foreign_material.id)).to be(true)
    end

    it "fails NOT_FOUND for another user's plan id and deletes nothing (delta 2)" do
      result = described_class.call(current_user: other, id: plan.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(StudyPlan.exists?(plan.id)).to be(true)
      expect(KnowledgeNode.exists?(node.id)).to be(true)
      expect(Material.exists?(material.id)).to be(true)
    end

    it "refuses VALIDATION_FAILED when a plan material is also bound to a study task, deleting NOTHING" do
      # Reachable state (P1-2): attachMaterial(planId:) then
      # createTask(materialId:) — CreateTask only refuses materials that
      # already carry a task_id, so a plan material can gain a task later.
      # The delete sweep would hit study_tasks.material_id (no on_delete) and
      # explode as InvalidForeignKey → INTERNAL; the command refuses first,
      # before deleting anything.
      bound_task_node = create(:knowledge_node, user: user)
      bound_task = create(:study_task, user: user, material: material, node: bound_task_node)

      result = call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:message]).to include("study task")

      # NOTHING was deleted — the whole graph is intact.
      aggregate_failures do
        expect(StudyPlan.exists?(plan.id)).to be(true)
        expect(KnowledgeNode.exists?(node.id)).to be(true)
        expect(Material.exists?(material.id)).to be(true)
        expect(StudyTask.exists?(bound_task.id)).to be(true)
        expect(ReadingProgress.exists?(progress.id)).to be(true)
        expect(ChatThread.exists?(thread.id)).to be(true)
        expect(Flashcard.exists?(flashcard.id)).to be(true)
        expect(Annotation.exists?(annotation.id)).to be(true)
        expect(SectionMarking.exists?(marking.id)).to be(true)
        expect(QuizSession.exists?(session.id)).to be(true)
        expect(Question.exists?(question.id)).to be(true)
        expect(EvidenceRecord.exists?(evidence.id)).to be(true)
        expect(MistakeEntry.exists?(mistake.id)).to be(true)
      end
    end

    it "sweeps a PROMOTED task pointer and its task-scope sessions with the plan (epic-14 T2)" do
      # The promotion's end state (Tasks::PromoteTaskToPlanCommand's shape,
      # built directly): the task's node and material now belong to THIS plan
      # (task links cleared), the task row is the read-only pointer. Deleting
      # the plan deletes the pointer with it — the pointer's content lives in
      # the plan, so nothing survives to point at — plus the task-scope
      # sessions the pointer still owns (quiz_sessions.task_id has no
      # on_delete); every evidence/mistake/question row riding those sessions
      # is covered by the node/material sweeps (the moved node's id is in the
      # plan's node set).
      moved_node = create(:knowledge_node, user: user, plan: plan)
      moved_material = create(:material, user: user, plan: plan)
      pointer = create(:study_task, user: user, material: moved_material, node: moved_node)
      # The factory back-fills the task links (the triangle's insert dance);
      # the promotion cleared them — mirror its end state exactly.
      moved_node.update!(task_id: nil)
      moved_material.update!(task_id: nil)
      pointer.update!(promoted_plan_id: plan.id, promoted_at: Time.current)

      old_session = create(:quiz_session, user: user, task: pointer, plan: nil)
      old_question = create(:question, user: user, session: old_session, node: moved_node, source_material: moved_material)
      old_evidence = create(:evidence_record, user: user, node: moved_node, session: old_session, question: old_question)
      old_mistake = create(:mistake_entry, user: user, question: old_question, node: moved_node, session: old_session)

      result = call

      expect(result.success?).to be(true)
      # The pointer dies with the plan (nothing left to point at)…
      expect(StudyTask.exists?(pointer.id)).to be(false)
      expect(QuizSession.exists?(old_session.id)).to be(false)
      expect(Question.exists?(old_question.id)).to be(false)
      expect(EvidenceRecord.exists?(old_evidence.id)).to be(false)
      expect(MistakeEntry.exists?(old_mistake.id)).to be(false)
      # …while the user's plan-free task triangle is untouched.
      expect(StudyTask.exists?(task.id)).to be(true)
    end

    it "fails NOT_FOUND for an unknown id" do
      result = call(id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end
end
