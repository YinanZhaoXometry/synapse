# frozen_string_literal: true

# Logs a wrong answer against its question; node follows the question's node
# (attribution matches provenance) unless overridden. source_location is the
# ReadingLocator jsonb verbatim ({kind:"markdown",sectionId}, AD-2). session
# stays null (TS: nullable); forfeited defaults to false in the DB.
FactoryBot.define do
  factory :mistake_entry do
    user
    question { association :question, user: user }
    node { question.node }
    user_answer { "Scoping lives in the frontend" }
    source_location { { "kind" => "markdown", "sectionId" => "sec-1" } }
  end
end
