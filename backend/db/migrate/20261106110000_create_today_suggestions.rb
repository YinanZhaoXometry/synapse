# frozen_string_literal: true

# The today_suggestions table (epic-18 T2, spec decisions 7–10): the
# generation-backed Today suggestion — ONE persisted row per
# (user, plan, UTC day), produced only by the explicit
# generateTodaySuggestion mutation (never on hub load; the heuristic v1
# card in todayHub stays verbatim as the always-present base — this table
# is the ADDITION, not a replacement). `client_uuid` is the deterministic
# per-(user, plan, UTC day) replay key (uuid5 over the user-scoped
# namespace + planId + day, Ai::TodaySuggestionKey — globally unique, the
# replay-before-spend law reads it). `node_id` is the chosen node (the
# wire's nodeTitle resolves through it — the model never owns the title);
# `reason` is the AI's one-line why (null:false — the card explains
# itself or it is unusable); `day` is the generation's UTC day (the
# "YYYY-MM-DD" day-key convention, the replay key's day half).
class CreateTodaySuggestions < ActiveRecord::Migration[8.1]
  def change
    create_table :today_suggestions, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.references :plan, type: :uuid, null: false, index: true
      t.references :node, type: :uuid, null: false, index: true
      t.text :reason, null: false
      t.string :client_uuid, null: false
      t.date :day, null: false

      t.timestamps

      t.index :client_uuid, unique: true
    end

    add_foreign_key :today_suggestions, :users, validate: false
    add_foreign_key :today_suggestions, :study_plans, column: :plan_id, validate: false
    add_foreign_key :today_suggestions, :knowledge_nodes, column: :node_id, validate: false
  end
end
