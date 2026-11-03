# frozen_string_literal: true

# The Flashcards context (AD-12): flashcard deck + study-state operations live
# under app/commands/flashcards/ (one directory per context, epic-03 kickoff
# delta 4).
#
# The context's one law (delta 5, verbatim): flashcard study-state is the
# `difficulty` self-rating write on the Flashcard row — Phase 1 NEVER creates
# EvidenceRecords from flashcards (frontend/src/domain/entities.ts; ADR-0001:
# the Mastery Score moves on quiz evidence only). No command here touches the
# evidence table.
module Flashcards
  # The self-rating vocabulary (Phase-1 rateFlashcard: "hard" | "medium" | "easy").
  DIFFICULTIES = %w[hard medium easy].freeze
end
