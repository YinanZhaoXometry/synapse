# frozen_string_literal: true

# Second step of the strong_migrations two-step dance (the
# extend_stream_tickets_op_check precedent): validate the two constraints the
# epic-36 T1 migration added unvalidated — the materials origin axis and the
# widened stream_tickets op vocabulary.
class ValidateEpic36CheckConstraints < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :materials, name: "materials_origin_check"
    validate_check_constraint :stream_tickets, name: "stream_tickets_op_check"
  end
end
