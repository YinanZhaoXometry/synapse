# frozen_string_literal: true

# AD-13: EvidenceRecord — the only unit that moves a Mastery Score (GLOSSARY).
# Node attribution is required (AD-6); session/question are nullable (a
# forfeit or a non-quiz attribution still records, outcome "wrong").
class CreateEvidenceRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :evidence_records, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :node, type: :uuid, null: false, foreign_key: { to_table: :knowledge_nodes }
      t.references :session, type: :uuid, foreign_key: { to_table: :quiz_sessions }
      t.references :question, type: :uuid, foreign_key: true
      t.string :outcome, null: false
      t.check_constraint "outcome IN ('correct', 'partial', 'wrong')", name: "evidence_records_outcome_check"

      t.timestamps
    end
  end
end
