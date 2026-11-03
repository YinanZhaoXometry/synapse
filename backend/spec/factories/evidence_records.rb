# frozen_string_literal: true

# Node attribution is required (AD-6); session/question stay null (non-quiz
# attributions are valid). outcome has NO default — the factory supplies one.
FactoryBot.define do
  factory :evidence_record do
    user
    node { association :knowledge_node, user: user }
    outcome { "correct" }
  end
end
