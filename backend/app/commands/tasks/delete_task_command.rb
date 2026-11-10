# frozen_string_literal: true

module Tasks
  # Delete a study task — the FR-37 deletion half (epic-28 T4), mirroring
  # Plans::DeletePlanCommand in ONE transaction. Two shapes by the promoted
  # vocabulary (inferred from promoted_plan_id, never a boolean):
  #
  # - plan-free task: the full cascade. The task owns exactly one Material
  #   and one auto-created KnowledgeNode (AD-6's single-document triangle)
  #   and "a task's nodes have no life outside it, and neither does its
  #   material" — the same posture deletePlan takes. The server adds the
  #   sweeps the ER's foreign keys mandate before those rows can go: the
  #   task-scope quiz sessions (quiz_sessions.task_id, XOR owner check) and
  #   their question/evidence/mistake graph, flashcards, annotations,
  #   section markings, reading progress, and the chat thread. Task nodes
  #   have no edges (knowledge_node_edges.plan_id is NOT NULL — the stage
  #   graph is plan-side).
  # - promoted task (the read-only pointer, epic-14 T2): the content lives
  #   in the plan now — the promotion moved the node/material over and only
  #   the back-reference survives. Deleting the pointer deletes ONLY the
  #   pointer row and its task-scope quiz sessions with their dependent
  #   rows; the plan keeps its material, node, and plan-scope history.
  #
  # A foreign or unknown id is uniformly NOT_FOUND (delta-2 posture).
  class DeleteTaskCommand < ApplicationCommand
    option :current_user
    option :id

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a foreign
      # id gets (a malformed address must not degrade into an INTERNAL 500
      # from the uuid column comparison).
      unless id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "task not found" })
      end

      task = current_user.study_tasks.find_by(id: id)
      return Failure(:NOT_FOUND, { message: "task not found" }) unless task

      # The promoted state is INFERRED from the column (delta decision 4) —
      # the scope is a scope, there is no predicate method.
      task.promoted_plan_id.present? ? delete_pointer(task) : delete_plan_free_task(task)

      Success(deleted_task_id: task.id)
    end

    private

    # The pointer shape: task-scope sessions (the XOR check makes every
    # session with task_id set unreachable once the pointer goes) + their
    # dependent rows, then the pointer. The plan's graph is untouched.
    def delete_pointer(task)
      session_ids = task.quiz_sessions.ids
      question_ids = current_user.questions.where(session_id: session_ids).ids

      ActiveRecord::Base.transaction do
        current_user.evidence_records
          .where(session_id: session_ids)
          .or(current_user.evidence_records.where(question_id: question_ids))
          .delete_all
        current_user.mistake_entries.where(question_id: question_ids).delete_all
        current_user.questions.where(id: question_ids).delete_all
        current_user.quiz_sessions.where(id: session_ids).delete_all
        task.delete
      end
    end

    # The plan-free shape: the single-document triangle's full cascade, the
    # same deepest-first sweep order Plans::DeletePlanCommand runs.
    def delete_plan_free_task(task)
      material_ids = [ task.material_id ]
      node_ids = [ task.node_id ]
      session_ids = current_user.quiz_sessions.where(task_id: task.id).ids
      question_ids = current_user.questions
        .where(source_material_id: material_ids)
        .or(current_user.questions.where(node_id: node_ids))
        .or(current_user.questions.where(session_id: session_ids))
        .ids

      ActiveRecord::Base.transaction do
        # Referencing rows first, deepest (evidence) to shallowest, then the
        # triangle itself (node, material), then the task.
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
        # The triangle is MUTUALLY referential (AD-6) with plain FKs and no
        # on_delete: study_tasks.node_id/.material_id point at the pair while
        # knowledge_nodes.task_id/.materials.task_id point back. Null the
        # back-references first, then the task row, then the pair — the only
        # order the constraint graph allows.
        current_user.knowledge_nodes.where(id: node_ids).update_all(task_id: nil) # rubocop:disable Rails/SkipsModelValidations
        current_user.materials.where(id: material_ids).update_all(task_id: nil) # rubocop:disable Rails/SkipsModelValidations
        task.delete
        current_user.knowledge_nodes.where(id: node_ids).delete_all
        current_user.materials.where(id: material_ids).delete_all
      end
    end
  end
end
