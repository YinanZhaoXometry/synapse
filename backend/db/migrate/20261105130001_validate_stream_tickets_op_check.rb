# frozen_string_literal: true

# Validates the widened op check (the strong_migrations two-step — see
# 20261105130000_extend_stream_tickets_op_check).
class ValidateStreamTicketsOpCheck < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :stream_tickets, name: "stream_tickets_op_check"
  end
end
