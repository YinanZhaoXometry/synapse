# frozen_string_literal: true

# The generation-backed Today suggestion (epic-18 T2): one row per
# (user, plan, UTC day). The plan and node ride the owner's graph (the
# association overrides pass `user:` down — the single-owner invariant);
# day defaults to today's UTC date.
FactoryBot.define do
  factory :today_suggestion do
    user
    plan { association :study_plan, user: user }
    node { association :knowledge_node, user: user, plan: plan }
    reason { "掌握度最低，先从这里补起。" }
    client_uuid { SecureRandom.uuid }
    day { Date.current }
  end
end
