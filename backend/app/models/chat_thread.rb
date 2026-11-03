# frozen_string_literal: true

# The Companion conversation anchored 1:1 to a material. messages is the
# ChatMessage[] jsonb verbatim ({id, role, text, citations, createdAt}, AD-2) —
# the ER has no ChatMessage entity, so messages embed. Plan-creation
# transcripts are ephemeral (AD-5) and never persist here.
class ChatThread < ApplicationRecord
  belongs_to :user
  belongs_to :material
end
