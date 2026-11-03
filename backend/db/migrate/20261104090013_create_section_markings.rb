# frozen_string_literal: true

# AD-13: SectionMarking — the FR-15 Mastery Marking claim (a claim, never
# evidence; it can never move a score). section_id is a section slug
# (MaterialSection ids), not a uuid FK. History is allowed (claim → clear →
# re-claim), so (material_id, section_id) is deliberately NOT unique.
class CreateSectionMarkings < ActiveRecord::Migration[8.1]
  def change
    create_table :section_markings, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true
      t.string :section_id, null: false
      t.datetime :claimed_at, null: false
      t.datetime :cleared_at

      t.timestamps
    end
  end
end
