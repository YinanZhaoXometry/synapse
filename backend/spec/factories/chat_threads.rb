# frozen_string_literal: true

# Anchored 1:1 to its scope — a material (default) or a plan (the
# `:plan_scoped` trait, epic-25 T1); exactly one of the two anchors is set
# (the chat_threads_one_scope CHECK's model mirror rejects both/neither).
# messages is the ChatMessage[] jsonb verbatim — {id, role, text, citations,
# createdAt}, keys camelCase exactly as the TS shape (AD-2).
FactoryBot.define do
  factory :chat_thread do
    user
    material { association :material, user: user }
    messages do
      [
        { "id" => "msg-1", "role" => "assistant", "text" => "Ask me about this section.",
          "citations" => [], "createdAt" => "2026-11-04T10:00:00Z" }
      ]
    end

    trait :plan_scoped do
      material { nil }
      plan { association :study_plan, user: user }
    end
  end
end
