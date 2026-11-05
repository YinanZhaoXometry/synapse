# frozen_string_literal: true

# Validates the annotations_kind_check constraint added NOT VALID in
# ExtendAnnotationsForFr16 (the strong_migrations two-step — see that
# migration for the delta-3 column story).
class ValidateAnnotationsKindCheck < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :annotations, name: "annotations_kind_check"
  end
end
