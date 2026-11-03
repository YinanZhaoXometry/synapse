# frozen_string_literal: true

# AD-13: Question — strictly materials-sourced (FR-18/NFR-1). source_section_id
# is a section slug (MaterialSection ids are markdown slugs or `page-N`), not a
# uuid FK. options/keywords are jsonb arrays; the ER has no dedicated entities
# for them.
class CreateQuestions < ActiveRecord::Migration[8.1]
  def change
    create_table :questions, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :session, type: :uuid, null: false, foreign_key: { to_table: :quiz_sessions }
      t.references :node, type: :uuid, null: false, foreign_key: { to_table: :knowledge_nodes }
      t.string :kind, null: false
      t.text :prompt, null: false
      t.jsonb :options
      t.integer :correct_option_index
      t.references :source_material, type: :uuid, null: false, foreign_key: { to_table: :materials }
      t.string :source_section_id, null: false
      t.jsonb :keywords
      t.text :explanation, null: false
      t.check_constraint "kind IN ('open', 'choice')", name: "questions_kind_check"

      t.timestamps
    end
  end
end
