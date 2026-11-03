# frozen_string_literal: true

# AD-13: MistakeEntry — every wrong answer lands here (FR-23: with its source
# location). source_location is the ReadingLocator jsonb, keys kept verbatim
# from the TS shape (AD-2: consumed verbatim) — {kind:"pdf",page} |
# {kind:"markdown",sectionId}.
class CreateMistakeEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :mistake_entries, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :question, type: :uuid, null: false, foreign_key: true
      t.references :session, type: :uuid, foreign_key: { to_table: :quiz_sessions }
      t.references :node, type: :uuid, null: false, foreign_key: { to_table: :knowledge_nodes }
      t.text :user_answer, null: false
      t.jsonb :source_location, null: false
      t.boolean :forfeited, null: false, default: false

      t.timestamps
    end
  end
end
