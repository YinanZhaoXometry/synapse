# frozen_string_literal: true

# One AI-authored Markdown study note (delta decision 4). The DB's
# exactly-one-scope check (notes_scope_id_xor_check) makes the scope/id pair
# law: the default factory is plan-scoped (the plan carries user down so the
# graph shares one owner); the node/material traits null the plan and attach
# their own scope record — do not set several scope ids on one row.
FactoryBot.define do
  factory :note do
    user
    scope { "plan" }
    title { "Distributed systems study note" }
    body { "# Distributed systems study note\n\nGenerated body text.\n" }
    enrichment { [] }
    targeting { [] }
    plan { association :study_plan, user: user }

    trait :node_scoped do
      scope { "node" }
      plan { nil }
      node { association :knowledge_node, user: user }
    end

    trait :material_scoped do
      scope { "material" }
      plan { nil }
      material { association :material, user: user }
    end
  end
end
