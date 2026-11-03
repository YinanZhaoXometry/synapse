# frozen_string_literal: true

# Anchored 1:1 to a material (unique material_id). messages is the
# ChatMessage[] jsonb verbatim — {id, role, text, citations, createdAt}, keys
# camelCase exactly as the TS shape (AD-2).
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
  end
end
