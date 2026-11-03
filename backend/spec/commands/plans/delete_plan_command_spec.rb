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

    it "fails NOT_FOUND for an unknown id" do
      result = call(id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end
end
