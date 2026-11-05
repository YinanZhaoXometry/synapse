# frozen_string_literal: true

# The Annotations context (AD-12): the FR-16 highlight/underline ops live
# under app/commands/annotations/ (one directory per context, epic-03
# kickoff delta 4). The shape law (epic-13 T3, delta decisions 2+3) lives in
# the commands: the AD-2 locator per ReadingLocators, the range jsonb per
# the delta-3 matrix (sectionId xor page, agreeing with the locator kind;
# int offsets; non-empty quote), the closed kind/color vocabularies — the
# DB stores the range jsonb as-is. NOTE on the delta-3 idempotency triad
# (backend/AGENTS.md's "sixth arrives" note): the epic-13 delta review
# pinned addAnnotation WITHOUT a client uuid (single-click writes removed
# by id), so the triad stays at five commands and the extraction is not
# triggered.
module Annotations
  # The named palette keys (the reader's chips — the frontend's
  # ANNOTATION_COLORS, frontend/src/features/reader/annotation-engine.ts).
  NAMED_COLORS = %w[coral amber emerald blue].freeze

  # The body note's cap (the free-text note; the position-text cap class —
  # a per-field sanity bound, VALIDATION_FAILED beyond). The v1 UI sends
  # the empty note; the cap guards the column for the v2 editor.
  MAX_NOTE_CHARS = 2_000
end
