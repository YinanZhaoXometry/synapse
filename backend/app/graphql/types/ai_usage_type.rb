# frozen_string_literal: true

module Types
  # The FR-34 display consequence (epic-14 T1): today's AI-call count and
  # the daily limit, read from the AD-16 cap seam (Ai::DailyCap — the
  # counter is server truth; the display renders it, never recomputes).
  # Honest and neutral: the raw count + limit only — remaining/percentage
  # math is the web's rendering concern, and the api stages no theatrics.
  class AiUsageType < Types::BaseObject
    description "The caller's AI usage for today (FR-34, epic-14 T1): the cap counter's live count and the daily limit."

    field :calls_today, Int,
          null: false,
          description: "Provider calls counted today (midnight-UTC day key) for the caller — every call counted, including stream restarts."

    field :daily_limit, Int,
          null: false,
          description: "The daily call cap (AI_DAILY_CALL_CAP, default 50) — the seam's enforced limit."
  end
end
