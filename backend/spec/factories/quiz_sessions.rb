# frozen_string_literal: true

# Generated from a plan or a task — exactly one of plan_id/task_id is law in
# the database (quiz_sessions_exactly_one_owner_check, migration 090016), so
# the default factory attaches a plan (override with task: for task-side
# sessions — do not set both). status defaults to "active" in the DB. The user
# is passed down so the attached plan (and questions built off the session)
# share its owner.
FactoryBot.define do
  factory :quiz_session do
    user
    plan { association :study_plan, user: user }
    mode { "open" }
  end
end
