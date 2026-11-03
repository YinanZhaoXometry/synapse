# frozen_string_literal: true

# AD-15: email + a real, known password (has_secure_password digests it on
# assignment — the test env digests at BCrypt::Engine::MIN_COST (4), not
# BCrypt::Engine.cost (12): Rails' activemodel railtie initializer sets
# `ActiveModel::SecurePassword.min_cost = Rails.env.test?` (verified
# empirically in the container, epic P2-2 review P1-B; pinned by
# spec/models/user_spec.rb), so this is free — no app-side bcrypt config
# exists or is needed). Passing `password:` per-spec overrides the default.
# Ids are NEVER pre-assigned here: every factory lets the gen_random_uuid()
# server default fill them (AD-12, client-suppliable).
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user-#{n}@synapse.test" }
    password { "synapse-test-password" }
  end
end
