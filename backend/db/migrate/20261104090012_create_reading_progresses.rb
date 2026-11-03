# frozen_string_literal: true

# AD-13: ReadingProgress — tracks 1:1 with a material (unique FK). position is
# the ReadingPosition jsonb ({locator, text}, keys verbatim from the TS shape,
# AD-2). Table name is the Rails pluralization of the ER name verbatim.
class CreateReadingProgresses < ActiveRecord::Migration[8.1]
  def change
    create_table :reading_progresses, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.jsonb :position, null: false

      t.timestamps
    end
  end
end
