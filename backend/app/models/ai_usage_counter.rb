# frozen_string_literal: true

# One row per user per UTC day counting provider calls (AD-16/FR-34, epic
# P2-5 ticket 02 — assumption A1). Written ONLY through Ai::DailyCap.consume!
# (the atomic upsert-increment); read back through Ai::DailyCap.count_for —
# since epic-14 T1 the count also rides the wire (aiUsageToday, FR-34's
# display consequence): it stays enforcement state, never domain data, and
# the seam owns both directions.
class AiUsageCounter < ApplicationRecord
  belongs_to :user
end
