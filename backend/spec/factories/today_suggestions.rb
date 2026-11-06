# frozen_string_literal: true

# The generation-backed Today suggestion (epic-18 T2): one row per
# (user, plan, UTC day). The plan and node ride the owner's graph (the
# association overrides pass `user:` down — the single-owner invariant);
# day IS the UTC-day contract (Ai::TodaySuggestionKey's `now.utc.to_date`
# derivation) — never the zone-local Date.current, which only coincides
# when the env zone happens to be UTC.
FactoryBot.define do
  factory :today_suggestion do
    user
    plan { association :study_plan, user: user }
    node { association :knowledge_node, user: user, plan: plan }
    reason { "掌握度最低，先从这里补起。" }
    client_uuid { SecureRandom.uuid }
    day { Time.now.utc.to_date }
  end
end
