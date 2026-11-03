# frozen_string_literal: true

# The Markings context (AD-12): the FR-15 Mastery Marking claim/unmark ops
# live under app/commands/markings/ (one directory per context, epic-03
# kickoff delta 4). The context's one law (the SectionMarking model comment,
# verbatim): a claim is a claim, NEVER evidence — no command here touches
# the evidence_records table; history is preserved (clearing sets cleared_at,
# re-claiming lands a new row, nothing is unique).
module Markings
end
