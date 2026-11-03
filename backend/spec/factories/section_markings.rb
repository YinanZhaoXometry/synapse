# frozen_string_literal: true

# FR-15 claim — a claim, never evidence. section_id is a section slug (the
# material factory's sample section); claimed_at has no DB default (the
# command layer sets it at claim time). cleared_at stays null (open claim).
FactoryBot.define do
  factory :section_marking do
    user
    material { association :material, user: user }
    section_id { "sec-1" }
    claimed_at { Time.current }
  end
end
