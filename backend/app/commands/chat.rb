# frozen_string_literal: true

# The Chat context (AD-12): Companion transcript persistence lives under
# app/commands/chat/ (one directory per context, epic-03 kickoff delta 4).
# Persistence only — the STREAM mints chat content (epic-05's AD-16 story);
# this context stores what arrived. Plan-creation transcripts are ephemeral
# (AD-5) and never pass through here.
module Chat
  # The message-author vocabulary (Phase-1 ChatMessage.role:
  # "user" | "companion" — frontend/src/domain/entities.ts).
  ROLES = %w[user companion].freeze
end
