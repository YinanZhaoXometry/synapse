# frozen_string_literal: true

# plan/task stay null by default (a plan's node has no task; a Study Task's
# auto-created node has no plan) — the study_task factory wires the task↔node
# triangle after create. No default for `order` (clients supply it).
FactoryBot.define do
  factory :knowledge_node do
    user
    title { "Command layer" }
    order { 1 }
  end
end
