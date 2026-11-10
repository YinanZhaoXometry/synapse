# frozen_string_literal: true

module Types
  class QueryType < Types::BaseObject
    # The scaffold's single sanctioned query (epic-00 T02) plus the domain
    # queries landing with their epics (AD-12 command core). The reads are
    # bare association reads, not use cases: the scoping IS the logic —
    # every user-scoped one resolves through the caller's own association
    # path (kickoff delta 2), so the reader cannot name a row that is not
    # theirs. Auth-guarded per delta 8 via CurrentUserGuard (the same seam
    # the mutations use) — the sole exception is the Square public read
    # path (epic P2-11 T2, AD-13's sanctioned exception), which never
    # consults caller identity and reads only through the explicit
    # StudyPlan.publicly_visible scope (see its section below). The Plans
    # reads landed with epic P2-3 ticket 01; the Tasks/Materials reads
    # with ticket 02; the quiz/evidence/flashcard reads with ticket 03;
    # the chat/progress reads with ticket 04; the re-queue's dueItems read
    # with epic P2-7 ticket 03.
    include CurrentUserGuard

    field :health, String, null: false,
      description: "Liveness probe: the api is up and answering queries."

    def health
      "ok"
    end

    # ── The Square public read path (FR-39, epic P2-11 T2) — the AD-13
    # sanctioned exception, kept deliberately next to `health`: together
    # they are the schema's ONLY unauthenticated-readable queries. Every
    # other field below demands auth via current_user!; these two never
    # consult the caller's identity at all (the resolver under
    # context[:current_user] stays lazy, so a no-token request pays zero
    # auth cost — the house opt-out is simply not calling current_user!).
    # Scoping is the stricter public-path posture (the P2-4 review): reads
    # go through the explicit StudyPlan.publicly_visible scope and the
    # plan's own node association — never a bare model reach — and answer
    # the reduced SquarePlanType structure set (NFR-7: no materials,
    # annotations, or scores EXIST on the type to select; the field-set
    # assertion spec pins it: spec/graphql/square_public_types_spec.rb).

    field :square_plans, [ Types::SquarePlanType ], null: false,
      description: "The Square's public plan listing (FR-39, epic P2-11 T2): every PUBLIC study plan from every owner, newest-first, as a plain list (AD-12 — no pagination v1, delta decision 2). The AD-13 sanctioned exception: readable WITHOUT authentication, structure only (NFR-7)."

    def square_plans
      # One plans query + one preloaded node pass — the summaries never
      # query per plan (SquarePlanType#node_summaries).
      StudyPlan.publicly_visible.order(created_at: :desc, id: :desc).includes(:knowledge_nodes)
    end

    field :square_plan, Types::SquarePlanType, null: true,
      description: "One public plan's structure-only preview by id (FR-39). A private, foreign, unknown, or malformed id is uniformly NOT_FOUND — the public path never reveals existence." do
      argument :id, String, required: true, description: "The plan's uuid."
    end

    def square_plan(id:)
      # The malformed-address guard first (a malformed id must not become a
      # 500 — the house `plan` posture), then the explicit public scope:
      # private rows are simply not addressed by this door, so unknown,
      # foreign, private, and malformed ids all answer the SAME NOT_FOUND
      # (no existence leak).
      return not_found("plan not found") unless id.match?(Accounts::UUID_REGEX)

      StudyPlan.publicly_visible.find_by(id: id) || not_found("plan not found")
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

    # The FR-15 marking read (epic-15 T1): the read half the marking surface
    # never had — claimSection/unclaimSection have been live since epic P2-3
    # T4, but no query exposed the rows back. A bare sanctioned read — the
    # scoping IS the logic (the material through the owner's association
    # path, delta 2), no command wraps a plain SELECT.
    field :section_markings, [ Types::SectionMarkingType ], null: false,
      description: "One material's Mastery Marking claim rows (FR-15, epic-15 T1 — the read side of claimSection/unclaimSection): ALL of the caller's rows for the material, open and cleared, newest first. Rows are history — an open claim has a null clearedAt, clearing sets clearedAt and never deletes — so the client derives the open claims. A claim is NEVER evidence: it can never move a Mastery Score (ADR-0001). A plain list (AD-12). A foreign, unknown, or malformed material id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The marked material's uuid."
    end

    def section_markings(material_id:)
      material = scoped_material(material_id)
      current_user!.section_markings.where(material_id: material.id).order(claimed_at: :desc, id: :desc)
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

    field :plan_mistake_entries, [ Types::MistakeEntryType ], null: false,
      description: "One plan's mistake entries (FR-46, epic P2-12 T3 — the plan companion's \"analyze my mistakes\" picker): every entry whose node belongs to the plan, in log order, with its mistaken question readable for the picker rows. A plain list (AD-12). A foreign or unknown plan id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :plan_id, String, required: true, description: "The plan's uuid."
    end

    def plan_mistake_entries(plan_id:)
      plan = scoped_plan(plan_id)
      current_user!.mistake_entries
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
                   .review_order
                   .includes(:schedulable)
                   .select { |schedule| schedule.schedulable }
    end

    # ── The hub read model (epic P2-09 T1, delta decision 4): seven separate
    # scoped queries, not a mega-field. Each answers on the scoping context;
    # the aggregation logic lives in Hubs (app/lib/hubs.rb) so the resolvers
    # stay thin. `now` is injected at the request (the freshness/streak
    # discipline — UTC by contract).

    field :mistakes_hub, [ Types::HubMistakeEntryType ], null: false,
      description: "The current user's mistake entries (FR-23, epic P2-09 T1): every wrong answer — Choice + Open — as a flat list newest-first, with the question (prompt + source material/section locators), the user's answer, the node/plan/task context, and the verbatim ReadingLocator sourceLocation + materialId for deep links. Grouping/filtering is the web's rendering concern (T2 decides). A plain list (AD-12)."

    def mistakes_hub
      Hubs.mistakes(current_user!)
    end

    field :today_hub, Types::TodayHubType, null: false,
      description: "The 今日学习 assembly (FR-27, epic P2-09 T1): the day's due reviews (epic-07's due logic verbatim — the materialized re-queue schedule, inclusive by the UTC day's end), the per-weak-plan quick-test suggestions (delta decision 2's v1 partial posture), the user's manual tasks, and the day's summary counts."

    def today_hub
      Hubs.today(current_user!, now: Time.current)
    end

    field :flashcard_decks_hub, [ Types::FlashcardDeckSummaryType ], null: false,
      description: "The current user's flashcard decks aggregated (FR-41, epic P2-09 T1): one row per material that has flashcards, grouped server-side — plan/task links and card counts ride each row. A plain list (AD-12)."

    def flashcard_decks_hub
      Hubs.flashcard_decks(current_user!)
    end

    field :flashcard_export, String, null: true,
      description: "One material's flashcard deck as an Anki text-import file (epic-31 T4): Anki 2.1.55+ headers + one tab-separated row per card, deck `Synapse::<material title>`, GUID = stable content hash so a re-import updates existing notes instead of duplicating them. An unknown, foreign, or malformed material id is uniformly NOT_FOUND; an empty deck is a headers-only file, not an error." do
      argument :material_id, String, required: true, description: "The material's uuid."
    end

    def flashcard_export(material_id:)
      material = nil
      if material_id.to_s.match?(Accounts::UUID_REGEX)
        material = current_user!.materials.find_by(id: material_id)
      end
      return not_found("material not found") unless material

      AnkiExport.for_material(material)
    end

    field :quiz_history_hub, [ Types::QuizHistoryEntryType ], null: false,
      description: "The current user's quiz sessions (FR-42, epic P2-09 T1): every session newest-first with its question count and the server-computed score summary (graded answers only — open unanswered/awaiting questions excluded honestly). A plain list (AD-12)."

    def quiz_history_hub
      Hubs.quiz_history(current_user!)
    end

    field :analytics_series, Types::AnalyticsSeriesType, null: false,
      description: "The current user's analytics series (FR-26, epic P2-09 T1): per-node mastery through the one Mastery scorer (freshness engaged), the weekly accuracy trend over the last 8 ISO weeks (Mon-UTC, weeks with evidence only), and the 14-day consistency strip (distinct evidence-producing sessions per UTC day, zeros included — SM-C3)."

    def analytics_series
      Hubs.analytics_series(current_user!, now: Time.current)
    end

    field :weekly_goal, Types::WeeklyGoalType, null: false,
      description: "The current user's weekly goal (FR-25's Phase-2 half, delta decision 3): the target vs. DISTINCT evidence-producing sessions in the current ISO week (Mon 00:00 UTC .. now — SM-C3: sessions, never minutes). Set via setWeeklyGoal."

    def weekly_goal
      Hubs.weekly_goal(current_user!, now: Time.current)
    end

    # ── The Settings account surfaces (FR-30/FR-34, epic-14 T1). Both reads
    # are auth-guarded through the shared guard; the export is a command
    # (the whole-document gather is a use case, the inverse of the import —
    # AD-12 command-layer-first), the usage read is a sanctioned bare read
    # through the cap seam.

    field :export_data, Types::ExportDataType, null: false,
      description: "The current user's whole document in the import's shape (FR-30, epic-14 T1; delta decision 1), as one JSON string for a client-side Blob download — the inverse of the first-login import, byte-faithful on the way back (export → importDocument on a fresh account re-builds the graph). Materials ride byteless; Phase-2-only rows without an import vocabulary (annotations, notes, mappings, study focus, manual tasks) don't ride."

    def export_data
      result = ::Export::ExportDataCommand.call(current_user: current_user!)
      raise_execution_error_for(result.failure) if result.failure?

      { document: JSON.generate(result.value![:document]) }
    end

    # The session identity read (epic-25 T3, epic decision 4): the chrome's
    # `me` — a bare sanctioned read over the caller (the scoping IS the
    # logic: the identity IS the authenticated account, nothing to scope),
    # answering the reduced MeType so no profile entity and no UserType
    # credentials surface ride. Auth-guarded through the shared guard like
    # every read here — unauthenticated is impossible on this field (the
    # AD-13 exceptions stay health + the Square path only).
    field :me, Types::MeType, null: false,
      description: "The current session's identity (epic-25 T3): the authenticated account's email — the chrome derives its display name and avatar letter from the local-part. Deliberately minimal (email only, epic-25 decision 4); auth-guarded like every read here."

    def me
      { email: current_user!.email }
    end

    field :ai_usage_today, Types::AiUsageType, null: false,
      description: "The current user's AI usage today (FR-34, epic-14 T1): the live cap-counter count (every provider call counted, midnight-UTC day key) and the enforced daily limit — server truth from the AD-16 cap seam, rendered honestly by the Settings display."

    def ai_usage_today
      user = current_user!
      # :: prefix — Types::Ai exists since epic-27 (ProposalMaterialInput); an unqualified Ai here would resolve into that namespace and NameError (the cpath-shadow trap, epic-05).
      { calls_today: ::Ai::DailyCap.count_for(user, now: Time.current), daily_limit: ::Ai::DailyCap.limit }
    end

    field :badge_state, [ Types::BadgeStateType ], null: false,
      description: "The current user's badge states (FR-28, delta decision 1): all 12 badges of the scaffold taxonomy computed on read, server-side — each with the raw counter and its threshold (b4 flashcards ≥10, b6 mistake-node revisits ≥5, b7/b8/b9 distinct mastered nodes 1/3/5, b10 ≥3 sessions in one UTC day, b11 a plan with every node mastered, b12 any node at score 100, streaks 3/7, evidence ≥100). The progressLabel string is the web's rendering concern (T6)."

    def badge_state
      Hubs.badge_state(current_user!, now: Time.current)
    end

    field :chat_thread, Types::ChatThreadType, null: true,
      description: "One material's Companion transcript (the getChatThread mirror) — null when the conversation has not started yet. A foreign or unknown material id is uniformly NOT_FOUND (kickoff delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The anchored material's uuid."
    end

    def chat_thread(material_id:)
      material = scoped_material(material_id)
      current_user!.chat_threads.find_by(material_id: material.id)
    end

    field :plan_chat_thread, Types::ChatThreadType, null: true,
      description: "One plan's Companion transcript (epic-25 T1 — the tutor page's plan-grounded thread, the material chatThread's plan-scope sibling) — null when the conversation has not started yet. A foreign, unknown, or malformed plan id answers null: honest-empty (never the material thread, and no existence leak)." do
      argument :plan_id, String, required: true, description: "The anchored plan's uuid."
    end

    def plan_chat_thread(plan_id:)
      # The sanctioned bare read (the scoping IS the logic): the plan
      # through the owner's association path, then the thread by its
      # unique plan scope. A malformed id addresses no row — the same null
      # an unknown or foreign one gets (the field is null: true, and the
      # ticket's posture for the plan read is honest-empty, not the
      # material path's NOT_FOUND raise).
      plan = current_user!.study_plans.find_by(id: plan_id) if plan_id.to_s.match?(Accounts::UUID_REGEX)
      current_user!.chat_threads.find_by(plan_id: plan&.id)
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

    # The FR-16 annotation read (epic-13 T3): one material's annotations,
    # the caller's own rows only, newest-first (the list renders the latest
    # first). A bare sanctioned read — the scoping IS the logic (the
    # material through the owner's association path, delta 2), no command
    # wraps a plain SELECT.
    field :annotations, [ Types::AnnotationType ], null: false,
      description: "One material's annotations (FR-16, epic-13 T3) — the caller's own rows, newest-first, as a plain list (AD-12). A foreign, unknown, or malformed material id is uniformly NOT_FOUND (delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The annotated material's uuid."
    end

    def annotations(material_id:)
      material = scoped_material(material_id)
      current_user!.annotations.where(material_id: material.id).order(created_at: :desc, id: :desc)
    end

    # The FR-17 Study Focus read (epic-13 T4): the caller's ONE active set
    # for the material, or null when it was never distilled (the honest
    # generate-CTA state). A bare sanctioned read — the scoping IS the
    # logic (the material through the owner's association path, delta 2),
    # no command wraps a plain SELECT.
    field :study_focus, Types::StudyFocusSetType, null: true,
      description: "The caller's active Study Focus set for one material (FR-17, epic-13 T4) — null when never generated. A foreign, unknown, or malformed material id is uniformly NOT_FOUND (delta 2 — never reveals existence)." do
      argument :material_id, String, required: true, description: "The distilled material's uuid."
    end

    def study_focus(material_id:)
      material = scoped_material(material_id)
      current_user!.study_focus_sets.find_by(material_id: material.id)
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
