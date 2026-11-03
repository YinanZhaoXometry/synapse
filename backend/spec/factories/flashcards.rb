# frozen_string_literal: true

# Seeded from a material; node stays null by default and difficulty stays
# unrated (null — self-rating only, never evidence).
FactoryBot.define do
  factory :flashcard do
    user
    material { association :material, user: user }
    front { "What scopes every row in Synapse?" }
    back { "A user_id foreign key (AD-13)." }
  end
end
