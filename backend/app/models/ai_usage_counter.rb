# frozen_string_literal: true

# One row per user per UTC day counting provider calls (AD-16/FR-34, epic
# P2-5 ticket 02 — assumption A1). Written ONLY through Ai::DailyCap.consume!
# (the atomic upsert-increment), read by nothing else: the count is
# enforcement state, not domain data — the schema deliberately never exposes
# it.
class AiUsageCounter < ApplicationRecord
  belongs_to :user
end
