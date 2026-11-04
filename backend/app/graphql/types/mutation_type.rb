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

    # Server-side AI (AD-16, epic P2-5 ticket 03): the streamed surfaces
    # (Companion chat, creation chat) are NOT here — they ride the one SSE
    # endpoint (/api/stream) with tickets minted by createStreamTicket
    # (ticket 04).
    field :generate_quiz, mutation: Mutations::Ai::GenerateQuiz
    field :generate_flashcards, mutation: Mutations::Ai::GenerateFlashcards
    field :grade_open_answer, mutation: Mutations::Ai::GradeOpenAnswer
    field :create_stream_ticket, mutation: Mutations::Ai::CreateStreamTicket
  end
end
