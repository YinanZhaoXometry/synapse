# frozen_string_literal: true

# The third stream op rides the frozen ticket contract (FR-46, epic P2-12
# T3): widen the op check constraint from the epic-05 pair to include
# "plan_companion" — the plan-scope chat surface. The model's enum-ish
# vocabulary lives in Ai::STREAM_OPS (the application seam); the database
# floor mirrors it (the create migration's pattern). strong_migrations'
# two-step shape: add unvalidated, then validate (the follow-up migration).
class ExtendStreamTicketsOpCheck < ActiveRecord::Migration[8.1]
  def change
    remove_check_constraint :stream_tickets, name: "stream_tickets_op_check"
    add_check_constraint :stream_tickets, "op IN ('companion', 'proposal', 'plan_companion')",
                         name: "stream_tickets_op_check", validate: false
  end
end
