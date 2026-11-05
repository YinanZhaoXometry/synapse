# frozen_string_literal: true

module Types
  # One badge on the badgeState read model (FR-28, epic P2-09 T1, delta
  # decision 1): the scaffold's 12-badge taxonomy computed ON READ (the
  # eventual-consistency posture — spec decision), thresholds pinned in
  # delta decision 1. The counter + threshold are the raw numbers; the
  # progressLabel string is T6's rendering concern.
  class BadgeStateType < Types::BaseObject
    description "One badge's state (FR-28, delta decision 1): unlocked + the raw counter/threshold — computed on read, server-side."

    field :id, String,
          null: false,
          description: "The badge's stable id (\"b1\"..\"b12\" — the scaffold taxonomy's order; i18n strings live web-side)."

    field :unlocked, Boolean,
          null: false,
          description: "Whether the counter meets the threshold."

    field :counter, Int,
          null: false,
          description: "The badge's raw current number (sessions/nodes/cards per delta decision 1's restated thresholds)."

    field :threshold, Int,
          null: false,
          description: "The unlock threshold (b4=10 flashcards, b6=5 mistake-node revisits, b7/b8/b9=1/3/5 mastered nodes, b10=3 sessions/day, streaks 3/7, b5=100 evidence — delta decision 1)."
  end
end
