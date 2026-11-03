# frozen_string_literal: true

module Types
  class QueryType < Types::BaseObject
    # The scaffold's single sanctioned query (epic-00 T02) plus the domain
    # queries landing with their epics (AD-12 command core). The reads are
    # bare association reads, not use cases: the scoping IS the logic —
    # every one resolves through the caller's own association path (kickoff
    # delta 2), so the reader cannot name a row that is not theirs.
    # Auth-guarded per delta 8 via CurrentUserGuard (the same seam the
    # mutations use). The Plans reads landed with epic P2-3 ticket 01; the
    # Tasks/Materials reads with ticket 02; the quiz/evidence/flashcard
    # reads with ticket 03.
    include CurrentUserGuard

    field :health, String, null: false,
      description: "Liveness probe: the api is up and answering queries."

    def health
      "ok"
    end

    field :plans, [ Types::StudyPlanType ], null: false,
      description: "The current user's study plans — a plain list (AD-12: Relay connections only when a list truly paginates)."

    def plans
      current_user!.study_plans.order(:created_at)
    end

    field :plan, Types::StudyPlanType, null: true,
      description: "One plan by id, detail with its node tree readable off it. A foreign or unknown id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :id, String, required: true, description: "The plan's uuid."
    end

    def plan(id:)
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a
      # foreign id gets (a malformed address must not become a 500).
      return not_found("plan not found") unless id.match?(Accounts::UUID_REGEX)

      current_user!.study_plans.find_by(id: id) || not_found("plan not found")
    end

    field :tasks, [ Types::StudyTaskType ], null: false,
      description: "The current user's study tasks — a plain list (AD-12: Relay connections only when a list truly paginates)."

    def tasks
      current_user!.study_tasks.order(:created_at)
    end

    field :task, Types::StudyTaskType, null: true,
      description: "One study task by id, with its auto-owned node readable off it. A foreign or unknown id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :id, String, required: true, description: "The task's uuid."
    end

    def task(id:)
      return not_found("task not found") unless id.match?(Accounts::UUID_REGEX)

      current_user!.study_tasks.find_by(id: id) || not_found("task not found")
    end

    field :materials, [ Types::MaterialType ], null: false,
      description: "The current user's materials — optionally scoped to one plan (the listMaterialsByPlan mirror) or one task (the listMaterialsByTask mirror); without arguments, all of them (the listMaterials mirror). A plain list (AD-12)." do
      argument :plan_id, String, required: false, description: "Scope to a plan's materials."
      argument :task_id, String, required: false, description: "Scope to a task's materials."
    end

    def materials(plan_id: nil, task_id: nil)
      if plan_id && task_id
        validation_failed("scope a material list by plan or task, not both", :planId)
      end

      scope = current_user!.materials
      if plan_id
        scope = scope.where(plan_id: scoped_plan(plan_id).id)
      elsif task_id
        scope = scope.where(task_id: scoped_task(task_id).id)
      end
      scope.order(:created_at)
    end

    field :material, Types::MaterialType, null: true,
      description: "One material by id — detail with its extracted sections. A foreign or unknown id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :id, String, required: true, description: "The material's uuid."
    end

    def material(id:)
      return not_found("material not found") unless id.match?(Accounts::UUID_REGEX)

      current_user!.materials.find_by(id: id) || not_found("material not found")
    end

    field :quiz_session, Types::QuizSessionType, null: true,
      description: "One quiz session by id — detail with its node-attributed questions in generation order (the getQuizSession + listQuestionsBySession mirrors). A foreign or unknown id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :id, String, required: true, description: "The session's uuid."
    end

    def quiz_session(id:)
      return not_found("quiz session not found") unless id.match?(Accounts::UUID_REGEX)

      current_user!.quiz_sessions.find_by(id: id) || not_found("quiz session not found")
    end

    field :evidence, [ Types::EvidenceRecordType ], null: false,
      description: "The current user's evidence records — all of them (the listEvidence mirror), or one node's when scoped by nodeId (the listEvidenceByNode mirror). A plain list (AD-12: evidence history is the Relay-connection candidate, but nothing paginates yet)." do
      argument :node_id, String, required: false, description: "Scope to one node's evidence. Unknown or foreign ids are NOT_FOUND."
    end

    def evidence(node_id: nil)
      return current_user!.evidence_records.order(:created_at) unless node_id

      current_user!.evidence_records.where(node_id: scoped_node(node_id).id).order(:created_at)
    end

    field :flashcards, [ Types::FlashcardType ], null: false,
      description: "The current user's flashcards — scoped to one material (the listFlashcardsByMaterial mirror) or one plan (the listFlashcardsByPlan mirror, through the plan's materials). The Phase-1 repo exposes no unscoped list, so exactly one scope is required." do
      argument :material_id, String, required: false, description: "Scope to a material's deck."
      argument :plan_id, String, required: false, description: "Scope to a plan's decks (through the plan's materials)."
    end

    def flashcards(material_id: nil, plan_id: nil)
      if material_id && plan_id
        validation_failed("scope a flashcard list by material or plan, not both", :materialId)
      end
      unless material_id || plan_id
        validation_failed("scope a flashcard list by material or plan (no unscoped list exists — the Phase-1 mirror)", :materialId)
      end

      if material_id
        current_user!.flashcards.where(material_id: scoped_material(material_id).id).order(:created_at)
      else
        current_user!.flashcards.joins(:material).where(materials: { plan_id: scoped_plan(plan_id).id })
                                .order(:created_at)
      end
    end

    private

    # The scope ids are ownership-checked addresses (delta 2): unknown,
    # foreign, and malformed ids are uniformly NOT_FOUND.
    def scoped_plan(plan_id)
      return not_found("plan not found") unless plan_id.match?(Accounts::UUID_REGEX)

      current_user!.study_plans.find_by(id: plan_id) || not_found("plan not found")
    end

    def scoped_node(node_id)
      return not_found("node not found") unless node_id.match?(Accounts::UUID_REGEX)

      current_user!.knowledge_nodes.find_by(id: node_id) || not_found("node not found")
    end

    def scoped_material(material_id)
      return not_found("material not found") unless material_id.match?(Accounts::UUID_REGEX)

      current_user!.materials.find_by(id: material_id) || not_found("material not found")
    end

    def scoped_task(task_id)
      return not_found("task not found") unless task_id.match?(Accounts::UUID_REGEX)

      current_user!.study_tasks.find_by(id: task_id) || not_found("task not found")
    end

    def not_found(message)
      raise_execution_error_for(ApplicationErrors::Failure.new(
        code: :NOT_FOUND, context: { message: message }
      ))
    end

    def validation_failed(message, field)
      raise_execution_error_for(ApplicationErrors::Failure.new(
        code: :VALIDATION_FAILED, context: { message: message, field: field }
      ))
    end
  end
end
