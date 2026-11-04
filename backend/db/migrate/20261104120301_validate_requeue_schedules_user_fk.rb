# frozen_string_literal: true

# Validates the user FK added NOT VALID in CreateRequeueSchedules (the
# strong_migrations house posture — 20261104120002's precedent; brand-new
# table, validation is instant).
#
# `up`/`down` instead of `change`: Rails 8.1's CommandRecorder has no
# invert_validate_foreign_key (same reason as 20261104090015).
class ValidateRequeueSchedulesUserFk < ActiveRecord::Migration[8.1]
  def up
    validate_foreign_key :requeue_schedules, :users
  end

  def down
    # no-op: validation-only (see the class comment)
  end
end
