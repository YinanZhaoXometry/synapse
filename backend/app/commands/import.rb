# frozen_string_literal: true

# The Import context (AD-12): the first-login carry-over lives under
# app/commands/import/ (one directory per context, epic-03 kickoff delta 4).
# One operation — the whole Phase-1 document arriving as ONE
# idempotent mutation (AD-15; epic P2-8 ticket 03). It writes through the
# existing contexts' tables only; it adds no model and no vocabulary of its
# own — the document's shape IS the contract (AD-4), read verbatim.
module Import
end
