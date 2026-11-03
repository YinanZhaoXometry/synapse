# frozen_string_literal: true

# AD-15: email + a real, known password (has_secure_password digests it on
# assignment — test env runs bcrypt at MIN_COST, so this is free). Passing
# `password:` per-spec overrides the default. Ids are NEVER pre-assigned here:
# every factory lets the gen_random_uuid() server default fill them (AD-12,
# client-suppliable).
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user-#{n}@synapse.test" }
    password { "synapse-test-password" }
  end
end
