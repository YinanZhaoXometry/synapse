# frozen_string_literal: true

# Second step of the strong_migrations two-step FK dance (epic P2-7's
# requeue_schedules precedent): validate the AI-usage-counter user FK that
# the create migration added as validate: false.
class ValidateAiUsageCountersUserFk < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :ai_usage_counters, :users
  end
end
