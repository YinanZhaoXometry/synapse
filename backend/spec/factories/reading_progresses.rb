# frozen_string_literal: true

# 1:1 with a material (unique material_id). position is the ReadingPosition
# jsonb verbatim ({locator, text}, AD-2) — locator keys camelCase.
FactoryBot.define do
  factory :reading_progress do
    user
    material { association :material, user: user }
    position do
      { "locator" => { "kind" => "markdown", "sectionId" => "sec-1" },
        "text" => "…where the reader stopped." }
    end
  end
end
