# frozen_string_literal: true

# plan/task stay null by default (attaching sets them); parse_state defaults
# to "pending" in the DB. sections carries one sample MaterialSection — keys
# verbatim from the TS shape, and it gives quizzes/marks a real section slug.
FactoryBot.define do
  factory :material do
    user
    title { "Distributed systems lecture notes" }
    kind { "markdown" }
    size_bytes { 12_345 }
    sections do
      [
        { "id" => "sec-1", "title" => "Introduction", "text" => "Scoping, commands, and the spine ER." }
      ]
    end
  end
end
