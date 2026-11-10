# frozen_string_literal: true

require "rails_helper"

RSpec.describe Tasks::DeleteTaskCommand do
  # Direct command testing (AD-10). The FR-37 deletion half (epic-28 T4):
  # a plan-free task cascades its single-document triangle (AD-6 — the
  # task's material and auto-node have no life outside it) plus every
  # FK-mandated dependent row, the same deepest-first sweep deletePlan
  # runs; a PROMOTED task is the pointer-only cut — the plan keeps its
  # content and history.

  let(:user) { create(:user) }

  let!(:task) { create(:study_task, user: user) }
  let!(:session) { create(:quiz_session, user: user, task: task, plan: nil) }
  let!(:question) do
    create(:question, user: user, session: session, node: task.node, source_material: task.material)
  end
  let!(:evidence) do
    create(:evidence_record, user: user, node: task.node, session: session, question: question)
  end
  let!(:mistake) do
    create(:mistake_entry, user: user, question: question, node: task.node, session: session)
  end
  let!(:flashcard) { create(:flashcard, user: user, material: task.material) }
  let!(:annotation) { create(:annotation, user: user, material: task.material) }
  let!(:marking) { create(:section_marking, user: user, material: task.material) }
  let!(:progress) { create(:reading_progress, user: user, material: task.material) }
  let!(:thread) { create(:chat_thread, user: user, material: task.material) }

  # Survivors: another user's task triangle must be untouched.
  let(:other) { create(:user) }
  let!(:foreign_task) { create(:study_task, user: other) }

  def call(overrides = {})
    described_class.call(current_user: user, id: task.id, **overrides)
  end

  describe ".call" do
    it "deletes the plan-free task with its single-document triangle and every dependent row" do
      result = call

      expect(result.success?).to be(true)
      expect(result.value![:deleted_task_id]).to eq(task.id)

      expect(StudyTask.exists?(task.id)).to be(false)
      expect(Material.exists?(task.material_id)).to be(false)
      expect(KnowledgeNode.exists?(task.node_id)).to be(false)
      expect(QuizSession.exists?(session.id)).to be(false)
      expect(Question.exists?(question.id)).to be(false)
      expect(EvidenceRecord.exists?(evidence.id)).to be(false)
      expect(MistakeEntry.exists?(mistake.id)).to be(false)
      expect(Flashcard.exists?(flashcard.id)).to be(false)
      expect(Annotation.exists?(annotation.id)).to be(false)
      expect(SectionMarking.exists?(marking.id)).to be(false)
      expect(ReadingProgress.exists?(progress.id)).to be(false)
      expect(ChatThread.exists?(thread.id)).to be(false)
    end

    it "leaves other users' task triangles alone" do
      call

      expect(StudyTask.exists?(foreign_task.id)).to be(true)
      expect(Material.exists?(foreign_task.material_id)).to be(true)
      expect(KnowledgeNode.exists?(foreign_task.node_id)).to be(true)
    end

    it "fails NOT_FOUND for another user's task id and deletes nothing (delta 2)" do
      result = described_class.call(current_user: other, id: task.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(StudyTask.exists?(task.id)).to be(true)
      expect(Material.exists?(task.material_id)).to be(true)
    end

    it "fails NOT_FOUND for a malformed id (a bad address is not an INTERNAL)" do
      result = described_class.call(current_user: user, id: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "fails NOT_FOUND for an unknown-but-well-formed id" do
      result = described_class.call(current_user: user, id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    describe "the promoted pointer (epic-14 T2's read-only pointer state)" do
      # Simulate the post-promotion state the honest way: the promotion moved
      # the node/material INTO the plan (plan_id set, task back-references
      # cleared) and only the pointer's study_tasks back-reference survives —
      # the exact shape PromoteTaskToPlanCommand leaves behind.
      let!(:plan) { create(:study_plan, user: user) }
      let!(:promoted) { create(:study_task, user: user) }
      let!(:promoted_session) { create(:quiz_session, user: user, task: promoted, plan: nil) }

      before do
        promoted.node.update!(plan: plan, task_id: nil)
        promoted.material.update!(plan: plan, task_id: nil)
        promoted.update!(promoted_plan: plan, promoted_at: Time.current)
      end

      it "deletes ONLY the pointer and its task-scope sessions; the plan keeps its content" do
        result = described_class.call(current_user: user, id: promoted.id)

        expect(result.success?).to be(true)
        expect(result.value![:deleted_task_id]).to eq(promoted.id)

        expect(StudyTask.exists?(promoted.id)).to be(false)
        expect(QuizSession.exists?(promoted_session.id)).to be(false)
        # the plan's graph survives the pointer's deletion
        expect(StudyPlan.exists?(plan.id)).to be(true)
        expect(Material.exists?(promoted.material_id)).to be(true)
        expect(KnowledgeNode.exists?(promoted.node_id)).to be(true)
      end

      it "the plan-free sibling is untouched by a pointer deletion" do
        described_class.call(current_user: user, id: promoted.id)

        expect(StudyTask.exists?(task.id)).to be(true)
        expect(QuizSession.exists?(session.id)).to be(true)
      end
    end
  end
end
