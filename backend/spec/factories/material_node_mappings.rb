# frozen_string_literal: true

# user (the owner, AD-13); material the section belongs to; node stays null
# by default — proposals point at nothing until confirm creates/picks the
# real node. section_id carries the material's own section slug verbatim.
FactoryBot.define do
  factory :material_node_mapping do
    user
    material
    node { nil }
    section_id { "sec-1" }
    proposed_node_title { nil }
    status { "proposed" }

    trait :confirmed do
      status { "confirmed" }
    end

    trait :rejected do
      status { "rejected" }
    end
  end
end
