# frozen_string_literal: true

# Generated from a plan or a task — plan_id/task_id stay null by default
# (exactly-one is command-layer business, not DB-enforced). status defaults
# to "active" in the DB. The user is passed down so questions built off the
# session share its owner.
FactoryBot.define do
  factory :quiz_session do
    user
    mode { "open" }
  end
end
