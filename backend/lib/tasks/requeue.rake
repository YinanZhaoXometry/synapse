# frozen_string_literal: true

namespace :requeue do
  desc "Force a user's re-queue schedules due now (dev/demo only — the re-queue shows up without waiting days)"
  task :force_due, [ :email ] => :environment do |_task, args|
    unless Rails.env.development? || Rails.env.test?
      abort "requeue:force_due is dev/demo-only — never prod-exposed (epic P2-7 ticket 03, AD-19's named-need posture)"
    end

    email = args[:email] or abort "usage: requeue:force_due[user@example.com]"
    user = User.find_by(email: email) or abort "no user #{email}"

    count = user.requeue_schedules.update_all(next_due_at: Time.current) # rubocop:disable Rails/SkipsModelValidations
    Rails.logger.info("requeue:force_due — #{count} schedule(s) due now for #{email}")
  end
end
