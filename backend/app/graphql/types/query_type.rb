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
    # Tasks/Materials reads with ticket 02.
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

    private

    # The scope ids are ownership-checked addresses (delta 2): unknown,
    # foreign, and malformed ids are uniformly NOT_FOUND.
    def scoped_plan(plan_id)
      return not_found("plan not found") unless plan_id.match?(Accounts::UUID_REGEX)

      current_user!.study_plans.find_by(id: plan_id) || not_found("plan not found")
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
