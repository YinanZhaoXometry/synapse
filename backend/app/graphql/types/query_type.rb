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
    # reads with ticket 03; the chat/progress reads with ticket 04; the
    # re-queue's dueItems read with epic P2-7 ticket 03.
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

    field :material_node_mappings, [ Types::MaterialNodeMappingType ], null: false,
      description: "One material's OR one node's mapping rows (FR-45, epic P2-10 T1; the node side lands with T3's click-through) — proposed / confirmed / rejected rows, one active row per user+material+section (delta decision 4). Exactly one of materialId / nodeId is required (the flashcards xor precedent). A plain list (AD-12). A foreign or unknown material/node id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :material_id, String, required: false, description: "Scope to a material's mapping rows (the per-material coverage read)."
      argument :node_id, String, required: false, description: "Scope to one node's mapping rows (the node click-through read — every status rides; the consumer filters confirmed)."
    end

    def material_node_mappings(material_id: nil, node_id: nil)
      if material_id && node_id
        validation_failed("scope a mapping list by material or node, not both", :materialId)
      end
      unless material_id || node_id
        validation_failed("scope a mapping list by material or node", :materialId)
      end

      if material_id
        material = scoped_material(material_id)
        current_user!.material_node_mappings.where(material_id: material.id).order(:created_at, :id)
      else
        node = scoped_node(node_id)
        current_user!.material_node_mappings.where(node_id: node.id).order(:created_at, :id)
      end
    end

    field :plan_node_mappings, [ Types::MaterialNodeMappingType ], null: false,
      description: "One plan's node-attached mapping rows in ONE read (FR-5/FR-7, epic P2-10 T4 — the plan-scope batch over the per-node reads; the roadmap graph's node-detail actions need every node's rows at once). Every status rides (the wire's one mapping-list vocabulary, T3's precedent); the consumer filters confirmed for its jump targets. Rows attached to NO node (the gap proposals / unmapped rows) serve no node surface and are excluded. A foreign or unknown plan id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :plan_id, String, required: true, description: "Scope to a plan's nodes' mapping rows."
    end

    def plan_node_mappings(plan_id:)
      plan = scoped_plan(plan_id)
      current_user!.material_node_mappings
                   .joins(:node)
                   .where(knowledge_nodes: { plan_id: plan.id })
                   .order(:created_at, :id)
    end

    field :notes, [ Types::NoteType ], null: false,
      description: "One plan's study notes (FR-40, epic P2-12 T1; delta decision 3 — plan-scoped, no separate destination): the plan's own notes PLUS the notes scoped to its nodes or its materials (the DB's exactly-one scope check keeps a note on exactly one id, so the plan's list is the union of all three). Newest first. A foreign or unknown plan id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence). A plain list (AD-12)." do
      argument :plan_id, String, required: true, description: "The plan's uuid."
    end

    def notes(plan_id:)
      plan = scoped_plan(plan_id)
      current_user!.notes
                   .where(plan_id: plan.id)
                   .or(current_user!.notes.where(node_id: plan.knowledge_nodes.ids))
                   .or(current_user!.notes.where(material_id: plan.materials.ids))
                   .order(created_at: :desc, id: :desc)
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

    # The evidence-day streak (epic P2-4 ticket 03, FR-25 / SM-C3): marshals
    # the caller's own evidence into Mastery — the only scorer (AD-14) — with
    # "now" injected at the request. The boundary is UTC by contract
    # (ADR-0001, amended 2026-11-04: a server cannot know a browser's local
    # time; a per-user timezone stays a deferred row).
    field :streak, Int, null: false,
      description: "The current user's evidence-day streak: consecutive UTC calendar days with at least one EvidenceRecord, ending at the latest evidence day — alive only while that day is today or yesterday (UTC), otherwise 0. Computed by the api's Mastery module; the boundary is UTC by contract (ADR-0001, amended 2026-11-04)."

    def streak
      # (created_at, id) order — the Mastery feed sites load deterministically
      # at the SQL seam (review P2-5a). The streak's day-key math is
      # order-insensitive; the seam stays uniform across the feed sites.
      Mastery.compute_streak(current_user!.evidence_records.order(:created_at, :id), now: Time.current)
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

    field :due_items, [ Types::DueItemType ], null: false,
      description: "The current user's due reviews (FR-24, the re-queue's Today-hub read, epic P2-7 ticket 03): the day's due mistakes and flashcards from the scan's materialized schedule, with their study-flow links. `date` defaults to today's end (UTC day boundary, matching the streak); due-ness is inclusive — everything scheduled BY that day's end answers, so an overdue item is still due and is never silently dropped." do
      argument :date, Types::DateTime, required: false, description: "The day to read (defaults to now's day; UTC day boundary)."
    end

    def due_items(date: nil)
      day_end = (date || Time.current).end_of_day
      # Sanctioned bare read (the scoping IS the logic): the owner's own
      # schedule rows, due by the day's end. The polymorphic preload makes
      # the dead-source skip free (a row deleted between scans prunes on the
      # next wake — never here). Per-user lists are small; a cap/pagination
      # is epic-09's call if the hub ever needs one (AD-12: not preempted).
      current_user!.requeue_schedules
                   .where(next_due_at: ..day_end)
                   .order(:next_due_at)
                   .includes(:schedulable)
                   .select { |schedule| schedule.schedulable }
    end

    field :chat_thread, Types::ChatThreadType, null: true,
      description: "One material's Companion transcript (the getChatThread mirror) — null when the conversation has not started yet. A foreign or unknown material id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The anchored material's uuid."
    end

    def chat_thread(material_id:)
      material = scoped_material(material_id)
      current_user!.chat_threads.find_by(material_id: material.id)
    end

    field :reading_progress, Types::ReadingProgressType, null: true,
      description: "One material's reading position (the getReadingProgress mirror) — null when the material was never opened. A foreign or unknown material id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The read material's uuid."
    end

    def reading_progress(material_id:)
      material = scoped_material(material_id)
      current_user!.reading_progresses.find_by(material_id: material.id)
    end

    field :reading_progress_list, [ Types::ReadingProgressType ], null: false,
      description: "Every reading position across the user's materials (the listReadingProgress mirror — the continue-reading shaping, FR-25). A plain list (AD-12)."

    def reading_progress_list
      current_user!.reading_progresses.order(:created_at)
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
