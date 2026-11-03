# frozen_string_literal: true

# AD-15 structural: email + password_digest only (auth logic lands with its
# own epic). email is the one uniqueness-bearing field — a sequence keeps
# graphs collision-free. Ids are NEVER pre-assigned here: every factory lets
# the gen_random_uuid() server default fill them (AD-12, client-suppliable).
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user-#{n}@synapse.test" }
    password_digest { "digest" }
  end
end
