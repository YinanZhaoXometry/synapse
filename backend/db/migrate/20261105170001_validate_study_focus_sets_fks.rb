# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the
# notes/stream_tickets/material_node_mappings precedent): validate the two
# FKs the create migration added as validate: false — user and material.
class ValidateStudyFocusSetsFks < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :study_focus_sets, :users
    validate_foreign_key :study_focus_sets, :materials
  end
end
