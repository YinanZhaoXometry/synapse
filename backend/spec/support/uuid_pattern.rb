# frozen_string_literal: true

# AD-12/AD-15: primary keys are uuid columns with a gen_random_uuid() server
# default, client-suppliable on create. Shared matcher for the per-model id
# assertions (epic P2-1 ticket 02; the shared user-scoping context lands with
# ticket 03).
#
# The shape itself is single-sourced on the app side (epic P2-2 review P2-5):
# Accounts::UUID_REGEX in app/lib/accounts.rb — the same constant
# TokenCodec#decode validates the `sub` claim against — so the spec matcher
# and the production guard cannot drift.
UUID_PATTERN = Accounts::UUID_REGEX

RSpec::Matchers.define :be_a_uuid do
  match do |actual|
    actual.is_a?(String) && UUID_PATTERN.match?(actual)
  end

  failure_message do |actual|
    "expected #{actual.inspect} to be a uuid-shaped string"
  end
end
