# frozen_string_literal: true

module Plans
  # Delete a study plan — the Phase-1 deletePlan mirror, in ONE transaction.
  # Phase-1 (plan-repository.ts) cascades plan + nodes + the plan's
  # materials + their 1:1 rows (ReadingProgress, ChatThread): "a plan's
  # nodes have no life outside it, and neither do its materials". The server
  # adds the sweeps the ER's foreign keys mandate before those rows can go —
  # the evidence/mistake/question/quiz-session graph (AD-6 attribution),
  # flashcards, annotations, and section markings. Phase-1 leaves those
  # dangling client-side; Postgres forbids it server-side, so the cascade is
  # deeper here, not narrower. Every sweep runs through the owner's
  # association path (kickoff delta 2), and a foreign or unknown id is
  # uniformly NOT_FOUND.
  class DeletePlanCommand < ApplicationCommand
    option :current_user
    option :id

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500
      # from the uuid column comparison).
      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "plan not found" })
      end

      plan = current_user.study_plans.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      material_ids = current_user.materials.where(plan_id: plan.id).ids
      node_ids = current_user.knowledge_nodes.where(plan_id: plan.id).ids
      session_ids = current_user.quiz_sessions.where(plan_id: plan.id).ids
      question_ids = current_user.questions
        .where(source_material_id: material_ids)
        .or(current_user.questions.where(node_id: node_ids))
        .or(current_user.questions.where(session_id: session_ids))
        .ids

      ActiveRecord::Base.transaction do
        # Referencing rows first, deepest (evidence) to shallowest, then the
        # Phase-1 cascade itself (nodes, materials, their 1:1 rows), then the
        # plan.
        current_user.evidence_records
          .where(node_id: node_ids)
          .or(current_user.evidence_records.where(question_id: question_ids))
          .or(current_user.evidence_records.where(session_id: session_ids))
          .delete_all
        current_user.mistake_entries
          .where(node_id: node_ids)
          .or(current_user.mistake_entries.where(question_id: question_ids))
          .delete_all
        current_user.questions.where(id: question_ids).delete_all
        current_user.flashcards
          .where(material_id: material_ids)
          .or(current_user.flashcards.where(node_id: node_ids))
          .delete_all
        current_user.annotations.where(material_id: material_ids).delete_all
        current_user.section_markings.where(material_id: material_ids).delete_all
        current_user.reading_progresses.where(material_id: material_ids).delete_all
        current_user.chat_threads.where(material_id: material_ids).delete_all
        current_user.quiz_sessions.where(id: session_ids).delete_all
        current_user.knowledge_nodes.where(id: node_ids).delete_all
        current_user.materials.where(id: material_ids).delete_all
        plan.delete
      end

      Success(deleted_plan_id: plan.id)
    end
  end
end
