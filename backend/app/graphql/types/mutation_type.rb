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

    field :create_plan, mutation: Mutations::Plans::CreatePlan
    field :confirm_proposal, mutation: Mutations::Plans::ConfirmProposal
    field :update_plan, mutation: Mutations::Plans::UpdatePlan
    field :delete_plan, mutation: Mutations::Plans::DeletePlan

    field :create_task, mutation: Mutations::Tasks::CreateTask
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

    field :create_flashcards, mutation: Mutations::Flashcards::CreateFlashcards
    field :rate_flashcard, mutation: Mutations::Flashcards::RateFlashcard

    field :append_chat_message, mutation: Mutations::Chat::AppendMessage
    field :save_reading_progress, mutation: Mutations::Progress::SaveReadingProgress
    field :claim_section, mutation: Mutations::Markings::ClaimSection
    field :unclaim_section, mutation: Mutations::Markings::UnclaimSection

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
  end
end
