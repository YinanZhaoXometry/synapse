# frozen_string_literal: true

# A materialized due-date row; the scan normally writes these (upsert), but
# specs pinning reads/pruning seed them directly. next_due_at has no default
# — the caller supplies the due fact under test. The polymorphic target is
# assigned per-type (default: a flashcard; `:for_mistake` trait), so type and
# id can never disagree.
FactoryBot.define do
  factory :requeue_schedule do
    user
    schedulable { association :flashcard, user: user }
    stage { 0 }
    next_due_at { 1.day.from_now }
    last_source_timestamp { Time.current }

    trait :for_mistake do
      schedulable { association :mistake_entry, user: user }
    end
  end
end
