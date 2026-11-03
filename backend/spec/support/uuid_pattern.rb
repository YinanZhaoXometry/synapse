# frozen_string_literal: true

# AD-12/AD-15: primary keys are uuid columns with a gen_random_uuid() server
# default, client-suppliable on create. Shared matcher for the per-model id
# assertions (epic P2-1 ticket 02; the shared user-scoping context lands with
# ticket 03).
UUID_PATTERN = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i

RSpec::Matchers.define :be_a_uuid do
  match do |actual|
    actual.is_a?(String) && UUID_PATTERN.match?(actual)
  end

  failure_message do |actual|
    "expected #{actual.inspect} to be a uuid-shaped string"
  end
end
