# frozen_string_literal: true

# The Requeue context (AD-19/FR-24, epic P2-7): the spaced-resurfacing story
# — the due-scan command and the scheduling ladders it enforces. Mistakes
# and flashcards share the mechanism; neither owns it.
module Requeue
  # The interval ladders (kickoff decision 8 — A1 fixed ladders, recorded in
  # spec.md + the ticket; the mistake ladder's shape amended by epic-31 to
  # geometric growth — deep-tutor comparison §3.7's adaptivity, discrete
  # form; revisited only with real usage, OQ-6's spirit).
  #
  # MISTAKE_STAGES[stage]: stage = the run of consecutive `correct` evidence
  # records for the same question AFTER the mistake's creation (a `wrong` or
  # `partial` resets to 0), counted over DISTINCT UTC days — a same-day
  # burst of corrects advances the stage once (epic-31's anti-grind guard:
  # one session cannot fill the ladder). The anchor is the latest relevant
  # source timestamp (the mistake's creation, or the latest post-mistake
  # evidence — whichever is newer), so due dates track the last study event.
  # Wrong-sooner: the mistake ladder's floor (1d) beats every flashcard
  # interval.
  MISTAKE_STAGES = [ 1.day, 2.days, 4.days, 8.days, 16.days ].freeze

  # FLASHCARD_LADDER[difficulty]: the self-rating (rateFlashcard's only
  # write — never evidence, ADR-0001) picks the interval; the anchor is the
  # flashcard's updated_at (the rating moment). An unrated card (difficulty
  # nil — never studied) is due immediately.
  FLASHCARD_LADDER = {
    "hard" => 2.days,
    "medium" => 5.days,
    "easy" => 10.days
  }.freeze
end
