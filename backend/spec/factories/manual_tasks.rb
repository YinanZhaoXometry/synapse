# frozen_string_literal: true

# The user's own Today-list task (epic P2-09 T1). due_date stays null (the
# unscheduled task) and done stays false — both are per-spec overrides.
FactoryBot.define do
  factory :manual_task do
    user
    title { "Rewrite the AD-13 summary" }
    due_date { nil }
    done { false }
  end
end
