# frozen_string_literal: true

# Second step of the strong_migrations two-step dance (the
# material_node_mappings precedent): validate the constraint and FK the
# first migration added as NOT VALID / validate: false.
class ValidateMaterialScopeConstraints < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :materials, name: "materials_attachment_scope_check"
    validate_foreign_key :materials, :knowledge_nodes, column: :node_id
  end
end
