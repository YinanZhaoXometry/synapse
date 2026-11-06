# frozen_string_literal: true

# Second step of the strong_migrations two-step dance (the
# today_suggestions/knowledge_node_edges precedents): validate the plan FK
# and the exactly-one-scope CHECK the plan_scoped_chat_threads migration
# added as validate: false.
class ValidatePlanScopedChatThreadsConstraints < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :chat_threads, :study_plans, column: :plan_id
    validate_check_constraint :chat_threads, name: "chat_threads_one_scope"
  end
end
