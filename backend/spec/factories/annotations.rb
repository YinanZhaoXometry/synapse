# frozen_string_literal: true

# FR-16/17 structural half: a ReadingLocator (jsonb verbatim, AD-2) + a body.
# Behavior lands with epics 10/13.
FactoryBot.define do
  factory :annotation do
    user
    material { association :material, user: user }
    locator { { "kind" => "pdf", "page" => 3 } }
    body { "Re-read this before the exam." }
  end
end
