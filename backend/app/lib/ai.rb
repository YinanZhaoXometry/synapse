# frozen_string_literal: true

# The Ai context root (epic P2-5): everything server-side AI lives under
# Ai::* — app/lib/ai/* (the seam, OpenAI-compatible transport, context assembly, prompts —
# the sibling of Accounts::* per the app/lib convention) and the AI commands
# under app/commands/ai/* (AD-16). This file is the namespace's ONLY root:
# app/commands/ai.rb deliberately does NOT exist — two root files would map
# the same cpath `Ai` and Zeitwerk would silently let one shadow the other.
# Note also that app/* directory names are invisible to Zeitwerk
# (app/models/user.rb → User), so the constant comes from THIS file and the
# app/lib/ai/ subdirectory, not from any directory named "ai".
module Ai
  # The reply-language vocabulary (AD-16: one language parameter, one policy
  # — every AI surface, mutations and streams alike, takes one of these and
  # is prompted to answer in it).
  LANGUAGES = %w[zh en].freeze

  # The stream-op vocabulary (AD-16, ticket 04 — the ticket contract): the
  # three streamed surfaces. "companion" = position-grounded study chat on a
  # material; "proposal" = the plan-creation chat's staged proposal (the
  # transcript is ephemeral per AD-5 — only the confirmed plan persists,
  # via the existing confirmProposal flow); "plan_companion" = the plan-scope
  # chat (FR-46, epic P2-12 T3 — no ReadingPosition, the plan grounding
  # carries it, with the optional mistake-entry input).
  STREAM_OPS = %w[companion proposal plan_companion].freeze

  # The stream-ticket TTL (AD-16: "opaque single-use secret, TTL ~60s").
  # Read from ENV at call time; garbage falls back to the default.
  DEFAULT_STREAM_TICKET_TTL_SECONDS = 60

  def self.stream_ticket_ttl_seconds
    value = ENV["AI_STREAM_TICKET_TTL_SECONDS"].to_s.strip.to_i
    value.positive? ? value : DEFAULT_STREAM_TICKET_TTL_SECONDS
  end

  # Command-layer doctrine (AD-12/AD-16): the AI commands (app/commands/ai/)
  # are deliberately NOT idempotent, unlike the delta-3 creates — every call
  # is a NEW generation, and the per-user daily cap bounds retries (FR-34).
  # The one exception is generateQuiz's client_uuid: the session uuid keeps
  # the delta-3 replay semantics (a same-user replay returns the existing
  # session WITHOUT a provider call — a network-timeout retry never spends
  # twice).
end
