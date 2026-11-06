# frozen_string_literal: true

# The endpoints ride the SAME plan and owner as the edge (AD-13: the whole
# graph shares one user — the derived associations pin `user: user` so an
# overridden `user:` coerces the whole graph, the evidence_record pattern).
FactoryBot.define do
  factory :knowledge_node_edge do
    user
    plan { association :study_plan, user: user }
    from_node { association :knowledge_node, user: user, plan: plan }
    to_node { association :knowledge_node, user: user, plan: plan }
  end
end
