# frozen_string_literal: true

module Types
  # The mutation surface (AD-12: resolvers/mutations call ApplicationCommand
  # classes). register/login landed with epic P2-2 ticket 02 — the first
  # schema movement; the Plans operations with epic P2-3 ticket 01; the
  # Tasks/Materials operations with ticket 02; the quiz/evidence/flashcard
  # operations with ticket 03; the chat/progress/marking operations with
  # ticket 04; the presigned direct-upload operation with epic P2-6 ticket
  # 02. No logout mutation by design (client-side token discard — epic-08).
  class MutationType < Types::BaseObject
    field :register, mutation: Mutations::Register
    field :login, mutation: Mutations::Login

    # The password change (AD-15, FR-30's account half, epic-14 T1): verb-
    # first next to its auth siblings. The session survives by design — the
    # stateless JWT needs no re-mint (delta decision 2, stated on the
    # mutation's description).
    field :change_password, mutation: Mutations::ChangePassword

    field :create_plan, mutation: Mutations::Plans::CreatePlan
    field :confirm_proposal, mutation: Mutations::Plans::ConfirmProposal
    field :update_plan, mutation: Mutations::Plans::UpdatePlan
    field :delete_plan, mutation: Mutations::Plans::DeletePlan

    # The FR-38 visibility flip (epic P2-11 T1): the Square opt-in/opt-out —
    # verb-first next to the updatePlan patch (the flip is a named,
    # confirm-gated product action, not a field patch).
    field :set_plan_visibility, mutation: Mutations::Plans::SetPlanVisibility

    # The Square adopt (FR-39 web half / OQ-12, epic P2-11 T3; delta decision
    # 5): the AUTHENTICATED fork — a structure-only copy of a public plan into
    # the caller's library, with attribution. Verb-first next to createPlan
    # (it creates a plan, from a public source).
    field :fork_square_plan, mutation: Mutations::Plans::ForkSquarePlan

    field :create_task, mutation: Mutations::Tasks::CreateTask

    # The FR-37 stretch half (epic-14 T2; delta decision 4): promote a study
    # task into a study plan — one transaction, evidence untouched (the
    # node's id is stable), the task flips to the read-only pointer.
    # Verb-first next to createTask (it creates a plan, from a task).
    field :promote_task_to_plan, mutation: Mutations::Tasks::PromoteTaskToPlan

    field :attach_material, mutation: Mutations::Materials::AttachMaterial
    field :set_material_parse_result, mutation: Mutations::Materials::SetMaterialParseResult

    # The attachment-scope surface (FR-44, epic P2-10 T2): pin an existing
    # material to one plan node or widen it back plan-wide.
    field :set_material_scope, mutation: Mutations::Materials::SetMaterialScope

    # The material↔node mapping surface (FR-45, epic P2-10 T1; delta
    # decisions 3+4): the AI map run (the mutation class lives with its AI
    # siblings under Mutations::Ai) + the user's confirm/reject verdicts.
    field :map_material_sections, mutation: Mutations::Ai::MapMaterialSections
    field :confirm_mapping_proposals, mutation: Mutations::Materials::ConfirmMappingProposals
    field :reject_mapping_proposals, mutation: Mutations::Materials::RejectMappingProposals

    field :create_quiz_session, mutation: Mutations::Quiz::CreateSession
    field :record_evidence, mutation: Mutations::Quiz::RecordEvidence
    field :abandon_quiz_session, mutation: Mutations::Quiz::AbandonSession

    # The hub retake (FR-42, epic P2-09 T4): the quiz history's per-completed-
    # session re-attempt — a fresh generation seeded from the old session's
    # scope + mode (never a replay of graded answers; NFR-8). Deliberately
    # not idempotent: each call mints a new attempt.
    field :retake_quiz_session, mutation: Mutations::Quiz::RetakeSession

    field :create_flashcards, mutation: Mutations::Flashcards::CreateFlashcards
    field :rate_flashcard, mutation: Mutations::Flashcards::RateFlashcard

    field :append_chat_message, mutation: Mutations::Chat::AppendMessage
    field :save_reading_progress, mutation: Mutations::Progress::SaveReadingProgress
    field :claim_section, mutation: Mutations::Markings::ClaimSection
    field :unclaim_section, mutation: Mutations::Markings::UnclaimSection

    # The FR-16 annotation ops (epic-13 T3, delta decision 3): the
    # highlight/underline writes — add pins the char-offset range (the
    # delta-3 shape law lives in the command), remove takes the row down.
    field :add_annotation, mutation: Mutations::Annotations::AddAnnotation
    field :remove_annotation, mutation: Mutations::Annotations::RemoveAnnotation

    field :create_material_upload, mutation: Mutations::Storage::CreateMaterialUpload

    # The first-login import (epic P2-8 ticket 03; AD-15): the whole
    # Phase-1 document as ONE idempotent mutation — the api command's home
    # per the kickoff delta-review (missing from epic-03's set, lands here).
    field :import_document, mutation: Mutations::ImportDocument

    # Server-side AI (AD-16, epic P2-5 ticket 03): the streamed surfaces
    # (Companion chat, creation chat) are NOT here — they ride the one SSE
    # endpoint (/api/stream) with tickets minted by createStreamTicket
    # (ticket 04).
    field :generate_quiz, mutation: Mutations::Ai::GenerateQuiz
    field :generate_flashcards, mutation: Mutations::Ai::GenerateFlashcards
    field :grade_open_answer, mutation: Mutations::Ai::GradeOpenAnswer
    field :create_stream_ticket, mutation: Mutations::Ai::CreateStreamTicket

    # The note generation surface (FR-40, epic P2-12 T1; delta decisions
    # 1+4+5): synchronous through the adapter — one cap-counted provider
    # call, deterministic replay on the client uuid.
    field :generate_note, mutation: Mutations::Ai::GenerateNote

    # The Study Focus generation surface (FR-17, epic-13 T4; OQ-1): the
    # note generation's synchronous posture — one cap-counted provider
    # call, deterministic replay on the client uuid; regeneration replaces
    # the one active set per user+material.
    field :generate_study_focus, mutation: Mutations::Ai::GenerateStudyFocus

    # The generation-backed Today suggestion (epic-18 T2, spec decisions
    # 7–11): the study-focus posture again — one cap-counted provider call,
    # replay-safe on the DETERMINISTIC per-(user, plan, UTC day) client
    # uuid. The todayHub heuristic v1 card is untouched (addition, not
    # replacement; the v1 card stays the always-present fallback).
    field :generate_today_suggestion, mutation: Mutations::Ai::GenerateTodaySuggestion

    # The weekly goal setter (FR-25's Phase-2 half, epic P2-09 T1; delta
    # decision 3): the target's home is users.weekly_goal_target; the
    # Settings UI lands with T5.
    field :set_weekly_goal, mutation: Mutations::Hubs::SetWeeklyGoal

    # The manual-task ops (FR-27, epic P2-09 T3): the writes T1 deferred —
    # the 今日学习 list's own add / completion toggle / delete. The read side
    # rides todayHub's manual list + summary counts.
    field :add_manual_task, mutation: Mutations::Hubs::AddManualTask
    field :set_manual_task_done, mutation: Mutations::Hubs::SetManualTaskDone
    field :delete_manual_task, mutation: Mutations::Hubs::DeleteManualTask

    # The mistake-lifecycle toggle (epic-18 T1, spec decision 4): the owner's
    # review toggle on a logged mistake — verb-first next to its sibling
    # setters. The flag is lifecycle + display only (readable on both mistake
    # types); it never moves a Mastery Score (AD-6/ADR-0001) and the targeting
    # bonus keeps riding any entry (the ruling annotated at
    # Ai::TargetingCandidates).
    field :set_mistake_entry_resolved, mutation: Mutations::Mistakes::SetMistakeEntryResolved
  end
end
