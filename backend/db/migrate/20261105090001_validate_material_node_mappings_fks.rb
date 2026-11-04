# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the
# ai_usage_counters/stream_tickets precedent): validate the three FKs the
# create migration added as validate: false — user, material, and the
# nullable node.
class ValidateMaterialNodeMappingsFks < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :material_node_mappings, :users
    validate_foreign_key :material_node_mappings, :materials
    validate_foreign_key :material_node_mappings, :knowledge_nodes, column: :node_id
  end
end
