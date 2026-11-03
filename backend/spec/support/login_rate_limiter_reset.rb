# frozen_string_literal: true

# The login rate limiter keeps per-process in-memory state (A2 — api-local,
# no Redis). Reset it before every example so accumulation can never leak
# between examples: tripping the limiter inside an example is always that
# example's own doing. `.reset!` is test-only by contract — application code
# relies on windows expiring, never on wiping.
RSpec.configure do |config|
  config.before { Accounts::LoginRateLimiter.reset! }
end
