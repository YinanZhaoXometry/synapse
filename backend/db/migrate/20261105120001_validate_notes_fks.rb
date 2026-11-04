# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the
# ai_usage_counters/stream_tickets/material_node_mappings precedent): validate
# the four FKs the create migration added as validate: false — user, plan,
# node, and material.
class ValidateNotesFks < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :notes, :users
    validate_foreign_key :notes, :study_plans, column: :plan_id
    validate_foreign_key :notes, :knowledge_nodes, column: :node_id
    validate_foreign_key :notes, :materials
  end
end
