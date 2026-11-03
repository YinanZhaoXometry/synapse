# frozen_string_literal: true

# The Materials context (AD-12): material metadata operations live under
# app/commands/materials/ (one directory per context, epic-03 kickoff
# delta 4). No bytes ever pass through here — parsing stays client-side
# (AD-7) and extracted text lives in Postgres (AD-13); file bytes are
# epic-06's ActiveStorage/R2 story and are deliberately absent from this
# whole surface.
module Materials
  # Kickoff delta 6: per-section extracted text is capped at 100,000
  # characters → VALIDATION_FAILED beyond (the quota-era bound carried
  # server-side; AD-4's bounded-section posture). Deviation from Phase-1,
  # recorded in the ticket Comments: the client repository silently
  # truncates at 2,000 chars (material-repository.ts boundText); the server
  # refuses instead of truncating — a silent rewrite of the client's
  # extracted text is not a contract the api should have.
  MAX_SECTION_CHARS = 100_000

  # The parse write-back's states (Phase-1 MaterialParseResult.state:
  # "parsed" | "failed") — the final transition of the parse state machine.
  # "pending"/"parsing" are attach-time states (the client attaches with the
  # state it is in), not write-back states.
  PARSE_RESULT_STATES = %w[parsed failed].freeze
end
