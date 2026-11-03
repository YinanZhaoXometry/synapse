# frozen_string_literal: true

# AD-13: Flashcard — seeded from a material; node attribution optional.
# difficulty is the user's own self-rating and never creates EvidenceRecords
# (GLOSSARY).
class CreateFlashcards < ActiveRecord::Migration[8.1]
  def change
    create_table :flashcards, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :material, type: :uuid, null: false, foreign_key: true
      t.references :node, type: :uuid, foreign_key: { to_table: :knowledge_nodes }
      t.text :front, null: false
      t.text :back, null: false
      t.string :difficulty
      t.check_constraint "difficulty IS NULL OR difficulty IN ('hard', 'medium', 'easy')",
                         name: "flashcards_difficulty_check"

      t.timestamps
    end
  end
end
