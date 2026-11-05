# frozen_string_literal: true

# One active Study Focus set (FR-17, epic-13 T4): user+material unique (the
# DB's unique index IS the law — do not create two for the same pair).
# items ride string-keyed TS keys verbatim (sourceRange = the AD-2 range);
# generation defaults 1 at the DB.
FactoryBot.define do
  factory :study_focus_set do
    user
    material { association :material, user: user }
    client_uuid { SecureRandom.uuid }
    items { [] }
    generation { 1 }
  end
end
