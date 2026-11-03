# frozen_string_literal: true

# AD-13: Annotation — the FR-16/17 structural half: a locator jsonb (same
# ReadingLocator shape, keys verbatim, AD-2) + a body on a material. All
# annotation behavior (editor UI, AI actions) lands with epics 10/13.
class CreateAnnotations < ActiveRecord::Migration[8.1]
  def change
    create_table :annotations, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true
      t.jsonb :locator, null: false
      t.text :body, null: false

      t.timestamps
    end
  end
end
