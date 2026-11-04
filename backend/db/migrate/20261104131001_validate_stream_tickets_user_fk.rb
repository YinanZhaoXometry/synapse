# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance: validate the
# stream-tickets user FK added as validate: false.
class ValidateStreamTicketsUserFk < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :stream_tickets, :users
  end
end
