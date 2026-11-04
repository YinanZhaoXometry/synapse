# frozen_string_literal: true

# call_count defaults to 0; boundary specs pre-set it (e.g. 49) instead of
# looping through consume!.
FactoryBot.define do
  factory :ai_usage_counter do
    user
    day { Time.current.utc.to_date }
    call_count { 0 }
  end
end
