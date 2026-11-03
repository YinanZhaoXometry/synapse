# frozen_string_literal: true

# AD-13: ChatThread — anchors 1:1 to a material (unique FK). messages is the
# ChatMessage[] jsonb (id/role/text/citations/createdAt, keys verbatim from
# the TS shape, AD-2) — the ER has no ChatMessage entity, so messages embed.
# Plan-creation transcripts are ephemeral (AD-5) and live nowhere.
class CreateChatThreads < ActiveRecord::Migration[8.1]
  def change
    create_table :chat_threads, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.jsonb :messages, null: false, default: []

      t.timestamps
    end
  end
end
