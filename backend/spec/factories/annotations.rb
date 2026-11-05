# frozen_string_literal: true

# FR-16: one user annotation on a material — locator + range jsonb (AD-2,
# string-keyed rows) + kind/color. body is the free-text note, empty by
# default (the pure highlight; `:noted` carries a note).
FactoryBot.define do
  factory :annotation do
    user
    material { association :material, user: user }
    locator { { "kind" => "pdf", "page" => 3 } }
    range { { "page" => 3, "start" => 12, "end" => 40, "quote" => "Scoping, commands, and the spine ER." } }
    color { nil }
    body { "" }

    trait :noted do
      body { "Re-read this before the exam." }
    end

    trait :underlined do
      kind { "underline" }
    end

    trait :markdown do
      locator { { "kind" => "markdown", "sectionId" => "sec-1" } }
      range { { "sectionId" => "sec-1", "start" => 0, "end" => 34, "quote" => "Scoping, commands, and the spine ER." } }
    end
  end
end
