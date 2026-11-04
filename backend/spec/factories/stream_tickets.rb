# frozen_string_literal: true

# payload defaults to a minimal companion-shaped payload; specs override op
# and payload for proposal tickets. token is randomized (the mint path uses
# SecureRandom too) — never a fixed value, tickets are secrets.
FactoryBot.define do
  factory :stream_ticket do
    user
    op { "companion" }
    token { SecureRandom.urlsafe_base64(32) }
    payload do
      {
        "material_id" => association(:material, user: user).id,
        "question" => "Explain this section",
        "language" => "zh"
      }
    end
    expires_at { Ai.stream_ticket_ttl_seconds.seconds.from_now }
  end
end
