# frozen_string_literal: true

# The Plans context (AD-12): plan + node operations live under
# app/commands/plans/ (one directory per context, epic-03 kickoff delta 4).
module Plans
  # FR-38 visibilities — the StudyPlan enum's values, single-sourced here
  # because the plan commands (create / confirm-proposal / update) all
  # validate against the same inclusion list. The Phase-1 TS shape has no
  # visibility at all; "private" is the FR-38 default, "public" the Square
  # opt-in (epic-11 reads it, structure only).
  VISIBILITIES = %w[private public].freeze
  DEFAULT_VISIBILITY = "private"
end
