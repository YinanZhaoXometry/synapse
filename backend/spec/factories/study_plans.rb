# frozen_string_literal: true

# goal stays null (TS: nullable); visibility defaults to private (FR-38).
FactoryBot.define do
  factory :study_plan do
    user
    topic { "COMP5241 software engineering" }
  end
end
