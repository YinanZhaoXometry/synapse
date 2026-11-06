# frozen_string_literal: true

# The prerequisite-edge table (FR-5 data half, epic-16 T1): a plan's real
# dependency graph as data — one row per from→to learning-order edge between
# two of the plan's nodes. The unique [from_node_id, to_node_id] index is the
# dedupe floor; validity itself (stage-forward) is a creation-time rule
# (Plans::PlanCreation drops invalid edges silently-but-logged), not a DB
# constraint — nodes carry stage labels, not indices, so the ordering lives
# above the schema. No position columns: layout is derived deterministically
# downstream. User-scoped per AD-13 like every table (the plan's owner —
# an edge never crosses a plan boundary).
class CreateKnowledgeNodeEdges < ActiveRecord::Migration[8.1]
  def change
    create_table :knowledge_node_edges, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.references :plan, type: :uuid, null: false, index: true
      t.references :from_node, type: :uuid, null: false, index: true
      t.references :to_node, type: :uuid, null: false, index: true

      t.timestamps

      t.index [ :from_node_id, :to_node_id ], unique: true,
              name: "index_knowledge_node_edges_on_from_node_and_to_node"
    end

    add_foreign_key :knowledge_node_edges, :users, validate: false
    # The columns are plan_id / from_node_id / to_node_id, not the
    # study_plan_id / knowledge_node_id a bare add_foreign_key would infer —
    # declared explicitly per the association-integrity sweep's landmine file.
    add_foreign_key :knowledge_node_edges, :study_plans, column: :plan_id, validate: false
    add_foreign_key :knowledge_node_edges, :knowledge_nodes, column: :from_node_id, validate: false
    add_foreign_key :knowledge_node_edges, :knowledge_nodes, column: :to_node_id, validate: false
  end
end
