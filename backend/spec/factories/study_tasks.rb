# frozen_string_literal: true

# AD-6: a Study Task owns exactly one Material and one auto-created
# KnowledgeNode, and the pair is mutually referential (study_tasks.node_id /
# study_tasks.material_id NOT NULL; knowledge_nodes.task_id /
# materials.task_id unique). Insert dance per ticket 02's Comments: create
# node and material with task_id null, create the task, then back-fill
# task_id on both. `user` is passed down so the whole triangle is owned by
# one user (pass user: explicitly — both blocks see the override).
FactoryBot.define do
  factory :study_task do
    user
    material { association :material, user: user }
    node { association :knowledge_node, user: user }

    after(:create) do |task, _evaluator|
      task.node.update!(task_id: task.id)
      task.material.update!(task_id: task.id)
    end
  end
end
