# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (the
# material_node_mappings/study_focus_sets precedent): validate the four FKs
# the create migration added as validate: false — user, plan, and the two
# node endpoints.
class ValidateKnowledgeNodeEdgesFks < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :knowledge_node_edges, :users
    validate_foreign_key :knowledge_node_edges, :study_plans, column: :plan_id
    validate_foreign_key :knowledge_node_edges, :knowledge_nodes, column: :from_node_id
    validate_foreign_key :knowledge_node_edges, :knowledge_nodes, column: :to_node_id
  end
end
